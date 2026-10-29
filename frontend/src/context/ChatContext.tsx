import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  AssistantReply,
  ChatMessage,
  EmotionMonitorState,
  JumpRequest,
  SampleDocumentKind,
} from '../types/chat';
import { INITIAL_MESSAGES } from '../data/seedData';
import { SAMPLE_DOCUMENTS } from '../data/sampleDocuments';
import { askGemini, isGeminiKeyUsable } from '../services/geminiService';
import { generateLocalDoutoraRosaResponse } from '../services/ragEngine';
import { buildAnonymizedPreview } from '../utils/anonymizer';
import { validateExamFile } from '../utils/examFileValidator';
import { formatClockTime } from '../utils/format';
import { analyzeImageFileLocally } from '../utils/imageAnalyzer';
import { safeGetStorage, safeSetStorage, STORAGE_KEYS } from '../utils/storage';
import { api, getStoredToken } from '../services/api';
import type { TriageInput } from '../types/triage';
import { AGE_RANGE_OPTIONS, cleanRosaFormatting, GENDER_LABELS, generateTriageDoctorResponse } from '../utils/triageClassifier';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const REPLY_DELAY_MS = 750;
const OFFLINE_ERROR_TEXT = 'Não foi possível enviar sua mensagem. Verifique sua conexão e tente novamente.';

let messageIdCounter = 0;
function makeMessageId(prefix: 'u' | 'r'): string {
  messageIdCounter += 1;
  return `${prefix}_${Date.now()}_${messageIdCounter}`;
}

const DEFAULT_EMOTION_MONITOR: EmotionMonitorState = {
  badgeLabel: 'Acolhimento Ativo',
  tone: 'default',
  explanation: 'default',
};

interface FailedMessage {
  text: string;
  docAttachment: string | null;
}

interface ChatContextValue {
  messages: ChatMessage[];
  isTyping: boolean;
  emotionMonitor: EmotionMonitorState;
  geminiApiKey: string;
  isUsingGemini: boolean;
  simulateOffline: boolean;
  errorBannerText: string | null;
  jumpRequest: JumpRequest | null;
  sendMessage: (text: string, docAttachment?: string | null) => Promise<void>;
  submitTriageToChat: (input: TriageInput) => void;
  sendAudioMessage: (audio: Blob) => Promise<void>;
  retryLastMessage: () => void;
  toggleOfflineSimulation: () => void;
  uploadExamFile: (file: File) => Promise<void>;
  simulateSampleDocument: (kind: SampleDocumentKind) => void;
  appendAssistantMessage: (emotionTag: string, text: string) => void;
  jumpToDate: (dateGroup: string) => void;
  saveGeminiKey: (key: string) => void;
  clearGeminiKey: () => void;
  submitFeedback: (messageId: string, rating: number, comment?: string, allowTrainingUse?: boolean) => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

function isMessageList(value: unknown): value is ChatMessage[] {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (typeof item !== 'object' || item === null) return false;
      const m = item as Record<string, unknown>;
      return (
        typeof m.id === 'string' &&
        typeof m.dateGroup === 'string' &&
        typeof m.time === 'string' &&
        typeof m.text === 'string' &&
        (m.sender === 'user' || m.sender === 'doutora_rosa')
      );
    })
  );
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function getInitialMessagesForUser(user: { fullName?: string; email?: string } | null): ChatMessage[] {
  if (!user || !user.email || user.email === 'maria.silva@exemplo.com') {
    return [...INITIAL_MESSAGES];
  }
  const firstName = user.fullName?.trim().split(' ')[0] || 'Usuária';
  return [
    {
      id: `welcome_${Date.now()}`,
      dateGroup: 'Hoje',
      time: formatClockTime(),
      sender: 'doutora_rosa',
      emotionTag: 'Acolhimento Inicial',
      text: `Olá, ${firstName}! 🌸 Seja muito bem-vinda ao RosaIA APP. Eu sou a Doutora Rosa, sua assistente virtual de acolhimento e educação em saúde mamária. Nossa conversa fica salva aqui com segurança para você me chamar sempre que precisar. Como você está se sentindo hoje?`,
    },
  ];
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const { user, isAuthenticated, accountResetToken } = useAuth();

  const getUserStorageKey = useCallback((email?: string) => {
    return email ? `${STORAGE_KEYS.messages}_${email.trim().toLowerCase()}` : STORAGE_KEYS.messages;
  }, []);

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const key = user?.email ? `${STORAGE_KEYS.messages}_${user.email.trim().toLowerCase()}` : STORAGE_KEYS.messages;
    return safeGetStorage<ChatMessage[]>(key, getInitialMessagesForUser(user), isMessageList);
  });
  const [isTyping, setIsTyping] = useState(false);
  const [emotionMonitor, setEmotionMonitor] = useState<EmotionMonitorState>(DEFAULT_EMOTION_MONITOR);
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => safeGetStorage(STORAGE_KEYS.geminiKey, '', isString));
  const [simulateOffline, setSimulateOffline] = useState(false);
  const [errorBannerText, setErrorBannerText] = useState<string | null>(null);
  const [jumpRequest, setJumpRequest] = useState<JumpRequest | null>(null);

  // Refs espelham o estado para que callbacks assíncronos sempre leiam o valor mais recente.
  const messagesRef = useRef(messages);
  const geminiKeyRef = useRef(geminiApiKey);
  const offlineRef = useRef(simulateOffline);
  const lastFailedRef = useRef<FailedMessage | null>(null);

  const commitMessages = useCallback(
    (next: ChatMessage[], persist = true) => {
      messagesRef.current = next;
      setMessages(next);
      if (persist) {
        const storageKey = getUserStorageKey(user?.email);
        safeSetStorage(storageKey, next);
      }
    },
    [getUserStorageKey, user?.email],
  );

  const setOffline = useCallback((value: boolean) => {
    offlineRef.current = value;
    setSimulateOffline(value);
  }, []);

  const pushMessage = useCallback(
    (message: ChatMessage) => commitMessages([...messagesRef.current, message]),
    [commitMessages],
  );

  // Sincroniza o chat quando a usuária autenticar ou trocar de conta
  useEffect(() => {
    const token = getStoredToken();
    const currentEmail = user?.email;
    const storageKey = getUserStorageKey(currentEmail);

    if (token && isAuthenticated) {
      api.chat
        .getHistory()
        .then((history) => {
          if (history && history.messages && history.messages.length > 0) {
            const mapped: ChatMessage[] = history.messages.map((m) => ({
              id: m.id,
              dateGroup: m.date_group,
              time: m.time,
              sender: m.sender,
              text: m.text,
              emotionTag: m.emotion_tag || undefined,
              docAttachment: m.doc_attachment,
              userRating: m.user_rating,
              aiModel: m.ai_model,
              usedFallback: m.used_fallback,
              urgencyLevel: m.urgency_level,
            }));
            commitMessages(mapped, true);
            return;
          }
          const fresh = getInitialMessagesForUser(user);
          commitMessages(fresh, true);
        })
        .catch(() => {
          const local = safeGetStorage<ChatMessage[]>(storageKey, getInitialMessagesForUser(user), isMessageList);
          commitMessages(local, false);
        });
    } else {
      const local = safeGetStorage<ChatMessage[]>(storageKey, getInitialMessagesForUser(user), isMessageList);
      commitMessages(local, false);
    }
  }, [user?.email, isAuthenticated, getUserStorageKey, commitMessages]);

  // Exclusão de conta ou Logout (LGPD): restaura estado limpo sem vazar para a próxima conta.
  const lastResetToken = useRef(accountResetToken);
  useEffect(() => {
    if (lastResetToken.current === accountResetToken) return;
    lastResetToken.current = accountResetToken;
    commitMessages([], false);
    geminiKeyRef.current = '';
    setGeminiApiKey('');
    setOffline(false);
    setErrorBannerText(null);
    setIsTyping(false);
    setEmotionMonitor(DEFAULT_EMOTION_MONITOR);
    lastFailedRef.current = null;
  }, [accountResetToken, commitMessages, setOffline]);

  const sendMessage = useCallback(
    async (text: string, docAttachment: string | null = null): Promise<void> => {
      if (!text.trim()) return;

      // Simulação de erro de rede / offline
      if (offlineRef.current) {
        lastFailedRef.current = { text, docAttachment };
        setErrorBannerText(OFFLINE_ERROR_TEXT);
        showToast('Falha no Envio', 'Não foi possível enviar a mensagem. Verifique sua conexão e tente novamente.', 'error');
        return;
      }

      setErrorBannerText(null);
      pushMessage({
        id: makeMessageId('u'),
        dateGroup: 'Hoje',
        time: formatClockTime(),
        sender: 'user',
        text,
        docAttachment,
      });
      setIsTyping(true);

      // 1. Tenta envio pela API FastAPI se houver token ativo e não for modo offline simulado
      let reply: AssistantReply | null = null;
      let apiReturnedId: string | null = null;
      let apiModelInfo: string | null = null;
      let apiUsedFallback = false;
      let apiUrgencyLevel = 'none';

      const token = getStoredToken();
      if (token && !offlineRef.current) {
        try {
          const apiMsg = await api.chat.sendMessage(text, docAttachment);
          apiReturnedId = apiMsg.id;
          apiModelInfo = apiMsg.ai_model || null;
          apiUsedFallback = !!apiMsg.used_fallback;
          apiUrgencyLevel = apiMsg.urgency_level || 'none';

          reply = {
            emotionTag: apiMsg.emotion_tag || 'Doutora Rosa • IA Conectada',
            text: apiMsg.text,
          };
          if (apiMsg.psychological_support_triggered) {
            setEmotionMonitor({
              badgeLabel: 'Apoio Psicológico Ativo (RAG/INCA)',
              tone: 'support',
              explanation: 'fear_symptom',
            });
          }
        } catch {
          // Fallback silencioso para Gemini direto ou motor local
          reply = null;
        }
      }

      // 2. Gemini direto (opcional se chave fornecida) caso a API não tenha respondido
      if (!reply && isGeminiKeyUsable(geminiKeyRef.current)) {
        reply = await askGemini(geminiKeyRef.current, text);
      }

      // 3. Fallback: motor RAG local (100% offline)
      if (!reply) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, REPLY_DELAY_MS));
        reply = generateLocalDoutoraRosaResponse(text);
        const update = reply.monitorUpdate;
        if (update) setEmotionMonitor((prev) => ({ ...prev, ...update }));
      }

      setIsTyping(false);
      pushMessage({
        id: apiReturnedId || makeMessageId('r'),
        dateGroup: 'Hoje',
        time: formatClockTime(),
        sender: 'doutora_rosa',
        emotionTag: reply.emotionTag,
        text: cleanRosaFormatting(reply.text),
        aiModel: apiModelInfo,
        usedFallback: apiUsedFallback,
        urgencyLevel: apiUrgencyLevel,
      });
    },
    [pushMessage, showToast],
  );

  const submitFeedback = useCallback(
    async (messageId: string, rating: number, comment?: string, allowTrainingUse = false) => {
      commitMessages(
        messagesRef.current.map((m) => (m.id === messageId ? { ...m, userRating: rating } : m)),
        true,
      );

      const token = getStoredToken();
      if (token && !offlineRef.current) {
        try {
          await api.chat.submitFeedback(messageId, rating, comment, allowTrainingUse);
          showToast(
            rating > 0 ? 'Obrigada pelo feedback! 🌸' : 'Feedback registrado',
            rating > 0
              ? 'Sua avaliação positiva ajuda a validar o cuidado da Doutora Rosa.'
              : 'Nossa equipe clínica revisará esta resposta para melhorar o acolhimento.',
            'success',
          );
        } catch {
          // Feedback salvo localmente
        }
      } else {
        showToast('Feedback salvo', 'Registrado no seu histórico local.', 'info');
      }
    },
    [commitMessages, showToast],
  );

  const retryLastMessage = useCallback(() => {
    setOffline(false);
    setErrorBannerText(null);
    const failed = lastFailedRef.current;
    if (failed) {
      lastFailedRef.current = null;
      void sendMessage(failed.text, failed.docAttachment);
    }
  }, [sendMessage, setOffline]);

  const toggleOfflineSimulation = useCallback(() => {
    const next = !offlineRef.current;
    setOffline(next);
    showToast(
      next ? 'Modo Sem Conexão Ativado' : 'Conexão Restaurada',
      next ? 'Modo de teste sem conexão ativado.' : 'O envio de mensagens voltou ao normal.',
      next ? 'warning' : 'success',
    );
  }, [setOffline, showToast]);

  const uploadExamFile = useCallback(
    async (file: File): Promise<void> => {
      const validation = await validateExamFile(file);

      if (!validation.ok) {
        if (validation.reason === 'file_too_large') {
          showToast(
            'Arquivo Muito Grande',
            `O arquivo "${file.name}" excede o tamanho máximo de 15 MB permitido para laudos e exames de imagem.`,
            'error',
          );
        } else {
          showToast(
            'Formato Não Permitido',
            `O arquivo "${file.name}" não é suportado. Envie laudos em PDF, TXT ou DOCX, ou exames de imagem em DICOM (.dcm), JPG, PNG, WEBP ou TIFF.`,
            'error',
          );
        }
        return;
      }

      // 1. Tenta análise direta e individualizada no backend (funciona com ou sem token JWT)
      if (!offlineRef.current) {
        try {
          showToast('Analisando Imagem/Exame...', 'A Doutora Rosa está avaliando especificamente o seu arquivo.', 'info');
          setIsTyping(true);
          const uploadRes = await api.upload.uploadDocument(file);
          showToast('🔬 Análise Concluída', 'A Doutora Rosa gerou a avaliação específica no chat.', 'success');

          if (uploadRes.user_message && uploadRes.assistant_message) {
            const u = uploadRes.user_message;
            const a = uploadRes.assistant_message;
            commitMessages([
              ...messagesRef.current,
              {
                id: u.id,
                dateGroup: u.date_group,
                time: u.time,
                sender: 'user',
                text: u.text,
                docAttachment: file.name,
              },
              {
                id: a.id,
                dateGroup: a.date_group,
                time: a.time,
                sender: 'doutora_rosa',
                emotionTag: a.emotion_tag || 'Análise Específica de Imagem • Doutora Rosa',
                text: cleanRosaFormatting(a.text),
                aiModel: a.ai_model,
                usedFallback: a.used_fallback,
                urgencyLevel: a.urgency_level,
              },
            ]);
            return;
          }

          if (uploadRes.educational_interpretation) {
            commitMessages([
              ...messagesRef.current,
              {
                id: makeMessageId('u'),
                dateGroup: 'Hoje',
                time: formatClockTime(),
                sender: 'user',
                text: `Enviei o arquivo para análise: ${file.name}`,
                docAttachment: file.name,
              },
              {
                id: makeMessageId('r'),
                dateGroup: 'Hoje',
                time: formatClockTime(),
                sender: 'doutora_rosa',
                emotionTag: 'Análise Específica de Imagem • Doutora Rosa',
                text: cleanRosaFormatting(uploadRes.educational_interpretation),
              },
            ]);
            return;
          }
        } catch {
          // Se o backend estiver offline, prossegue para a análise visual local/Gemini direto abaixo
        } finally {
          setIsTyping(false);
        }
      }

      // 2. Caso o servidor backend esteja indisponível: analisa os bytes da imagem/DICOM diretamente no navegador
      setIsTyping(true);
      try {
        const localImage = await analyzeImageFileLocally(file);
        if (localImage.isImageOrDicom) {
          const userMsg: ChatMessage = {
            id: makeMessageId('u'),
            dateGroup: 'Hoje',
            time: formatClockTime(),
            sender: 'user',
            text: `Enviei a imagem para análise individual: ${file.name}`,
            docAttachment: file.name,
          };

          let replyText = localImage.specificObjectiveReply;
          let emotionTag = localImage.isDicom
            ? 'Análise Técnica de Imagem DICOM • Doutora Rosa'
            : 'Análise Visual Específica • Doutora Rosa';

          if (!offlineRef.current && isGeminiKeyUsable(geminiKeyRef.current)) {
            const visionPrompt =
              `Analise individualmente, de forma objetiva e específica, a imagem enviada (${file.name}). ` +
              `Não faça discurso genérico sobre BI-RADS; descreva especificamente o que você vê na imagem e seus achados técnicos.\n` +
              `Contexto técnico extraído do arquivo:\n${localImage.technicalSummary}`;
            const geminiReply = await askGemini(
              geminiKeyRef.current,
              visionPrompt,
              localImage.jpegBase64
                ? { base64: localImage.jpegBase64, mimeType: localImage.jpegMimeType || 'image/jpeg' }
                : undefined,
            );
            if (geminiReply) {
              replyText = geminiReply.text;
              emotionTag = geminiReply.emotionTag;
            }
          }

          showToast('🔬 Imagem Analisada', 'Avaliação técnica e visual específica pronta no chat.', 'success');
          commitMessages([
            ...messagesRef.current,
            userMsg,
            {
              id: makeMessageId('r'),
              dateGroup: 'Hoje',
              time: formatClockTime(),
              sender: 'doutora_rosa',
              emotionTag,
              text: cleanRosaFormatting(replyText),
            },
          ]);
          return;
        }
      } catch {
        // Continua para leitura de documento textual se não for imagem
      } finally {
        setIsTyping(false);
      }

      // 3. Documento textual (PDF, TXT, DOCX) em modo local
      let rawContent = '';
      try {
        rawContent = await file.text();
      } catch {
        rawContent = '';
      }
      const preview = buildAnonymizedPreview(rawContent);
      showToast('📄 Documento Processado (LGPD)', 'Dados pessoais protegidos. Análise pronta no chat.', 'success');
      await sendMessage(
        `Doutora Rosa, enviei meu documento (${file.name}). Conteúdo desidentificado: "${preview || 'Documento anexado para análise'}". Pode analisar de forma objetiva os achados descritos?`,
        file.name,
      );
    },
    [commitMessages, sendMessage, showToast],
  );

  const simulateSampleDocument = useCallback(
    (kind: SampleDocumentKind) => {
      const scenario = SAMPLE_DOCUMENTS[kind];
      if (!scenario) return;
      showToast(scenario.toastTitle, scenario.toastMessage, 'success');
      void sendMessage(scenario.userMessage, scenario.fileName);
    },
    [sendMessage, showToast],
  );

  const submitTriageToChat = useCallback(
    (input: TriageInput) => {
      const realSymptoms = input.symptoms.filter((s) => s.toLowerCase() !== 'nenhum sintoma');
      const symptomsText = realSymptoms.length > 0 ? realSymptoms.join(', ') : 'Nenhum sintoma observado';
      const ageLabel = AGE_RANGE_OPTIONS.find((o) => o.value === input.ageRange)?.label || input.ageRange;

      let familyText = 'Não informado';
      if (input.familyHistory === 'sim') familyText = 'Sim (Mãe, irmã ou filha)';
      else if (input.familyHistory === 'nao') familyText = 'Não';
      else if (input.familyHistory === 'prefiro_nao_informar') familyText = 'Prefiro não informar';

      const lines: string[] = [
        'Doutora Rosa, acabei de realizar minha Triagem de Atenção Mamária com as seguintes informações:',
        `• Gênero: ${GENDER_LABELS[input.gender] || input.gender}`,
        `• Faixa Etária: ${ageLabel}`,
        `• Histórico Familiar de 1º Grau: ${familyText}`,
        `• Sinais ou Sintomas Observados: ${symptomsText}`,
      ];

      if (realSymptoms.length > 0) {
        if (input.symptomSide && input.symptomSide !== 'Prefiro não informar') {
          lines.push(`• Lado Afetado: ${input.symptomSide}`);
        }
        if (input.symptomDuration && input.symptomDuration !== 'Prefiro não informar') {
          lines.push(`• Tempo Observado: ${input.symptomDuration}`);
        }
      }

      if (input.pregnancyBreastfeeding && input.pregnancyBreastfeeding !== 'Prefiro não informar') {
        lines.push(`• Gestação / Amamentação: ${input.pregnancyBreastfeeding}`);
      }
      if (input.hormonesMeds && input.hormonesMeds !== 'Prefiro não informar') {
        lines.push(`• Uso de Hormônios / Medicação: ${input.hormonesMeds}`);
      }
      if (input.menopause && input.menopause !== 'Prefiro não informar') {
        lines.push(`• Menopausa: ${input.menopause}`);
      }
      if (input.radiotherapy && input.radiotherapy !== 'Prefiro não informar') {
        lines.push(`• Radioterapia no Tórax: ${input.radiotherapy}`);
      }
      if (input.medicalFollowup && input.medicalFollowup !== 'Prefiro não informar') {
        lines.push(`• Acompanhamento Mastologista/Ginecologista: ${input.medicalFollowup}`);
      }

      lines.push('\nGostaria da sua avaliação acolhedora e personalizada sobre esses dados que acabei de enviar.');

      const userMessageText = lines.join('\n');

      const userMsg: ChatMessage = {
        id: makeMessageId('u'),
        dateGroup: 'Hoje',
        time: formatClockTime(),
        sender: 'user',
        text: userMessageText,
      };

      const doctorReplyText = cleanRosaFormatting(generateTriageDoctorResponse(input));
      const doctorMsg: ChatMessage = {
        id: makeMessageId('r'),
        dateGroup: 'Hoje',
        time: formatClockTime(),
        sender: 'doutora_rosa',
        emotionTag: 'Acolhimento da Triagem • Doutora Rosa',
        text: doctorReplyText,
      };

      commitMessages([...messagesRef.current, userMsg, doctorMsg]);

      // Tenta registrar na API em segundo plano se autenticado
      const token = getStoredToken();
      if (token && !offlineRef.current) {
        // Persiste o par triagem/acolhimento na conversa da conta (visível em qualquer navegador)
        api.chat
          .saveTriageExchange(userMessageText, doctorReplyText, doctorMsg.emotionTag)
          .then((saved) => {
            const idMap: Record<string, string> = {
              [userMsg.id]: saved.user_message.id,
              [doctorMsg.id]: saved.assistant_message.id,
            };
            commitMessages(
              messagesRef.current.map((m) => {
                const newId = idMap[m.id];
                return newId ? { ...m, id: newId } : m;
              }),
            );
          })
          .catch(() => {});

        api.triage
          .assess({
            gender: input.gender,
            age_range: input.ageRange,
            has_family_history: input.familyHistory === 'sim',
            reported_signs: input.symptoms,
            emotional_impact_level: realSymptoms.length > 0 ? 3 : 1,
          })
          .catch(() => {});
      }
    },
    [commitMessages],
  );

  const sendAudioMessage = useCallback(
    async (audio: Blob): Promise<void> => {
      if (!getStoredToken() || offlineRef.current) {
        showToast('Áudio indisponível', 'Conecte-se à sua conta para conversar por áudio com a Doutora Rosa.', 'warning');
        return;
      }
      setErrorBannerText(null);
      setIsTyping(true);
      try {
        const res = await api.chat.sendAudio(audio);
        const user = res.user_message;
        const bot = res.reply;
        const toChat = (m: typeof user): ChatMessage => ({
          id: m.id,
          dateGroup: m.date_group,
          time: m.time,
          sender: m.sender,
          text: m.sender === 'doutora_rosa' ? cleanRosaFormatting(m.text) : `🎤 ${m.text}`,
          emotionTag: m.emotion_tag || undefined,
          docAttachment: m.doc_attachment,
          userRating: m.user_rating,
          aiModel: m.ai_model,
          usedFallback: m.used_fallback,
          urgencyLevel: m.urgency_level,
        });
        commitMessages([...messagesRef.current, toChat(user), toChat(bot)]);
        if (bot.psychological_support_triggered) {
          setEmotionMonitor({
            badgeLabel: 'Apoio Psicológico Ativo (RAG/INCA)',
            tone: 'support',
            explanation: 'fear_symptom',
          });
        }
      } catch (err) {
        const msg = err instanceof Error && err.message ? err.message : 'Não foi possível processar o áudio.';
        showToast('Falha no áudio', msg, 'error');
      } finally {
        setIsTyping(false);
      }
    },
    [commitMessages, showToast],
  );

  const appendAssistantMessage = useCallback(
    (emotionTag: string, text: string) => {
      pushMessage({
        id: makeMessageId('r'),
        dateGroup: 'Hoje',
        time: formatClockTime(),
        sender: 'doutora_rosa',
        emotionTag,
        text: cleanRosaFormatting(text),
      });
    },
    [pushMessage],
  );

  const jumpToDate = useCallback((dateGroup: string) => {
    setJumpRequest({ dateGroup, nonce: Date.now() });
  }, []);

  const saveGeminiKey = useCallback(
    (key: string) => {
      const clean = key.trim();
      geminiKeyRef.current = clean;
      setGeminiApiKey(clean);
      safeSetStorage(STORAGE_KEYS.geminiKey, clean);
      showToast('Configuração de IA Salva', clean ? 'Chave Gemini API configurada!' : 'Usando o motor RAG integrado.', 'success');
    },
    [showToast],
  );

  const clearGeminiKey = useCallback(() => {
    geminiKeyRef.current = '';
    setGeminiApiKey('');
    safeSetStorage(STORAGE_KEYS.geminiKey, '');
    showToast('Motor Integrado Ativo', 'Usando respostas clínicas e empáticas locais.', 'info');
  }, [showToast]);

  const value = useMemo<ChatContextValue>(
    () => ({
      messages,
      isTyping,
      emotionMonitor,
      geminiApiKey,
      isUsingGemini: geminiApiKey.length > 0,
      simulateOffline,
      errorBannerText,
      jumpRequest,
      sendMessage,
      submitTriageToChat,
      sendAudioMessage,
      retryLastMessage,
      toggleOfflineSimulation,
      uploadExamFile,
      simulateSampleDocument,
      appendAssistantMessage,
      jumpToDate,
      saveGeminiKey,
      clearGeminiKey,
      submitFeedback,
    }),
    [
      messages, isTyping, emotionMonitor, geminiApiKey, simulateOffline, errorBannerText, jumpRequest,
      sendMessage, submitTriageToChat, sendAudioMessage, retryLastMessage, toggleOfflineSimulation, uploadExamFile, simulateSampleDocument,
      appendAssistantMessage, jumpToDate, saveGeminiKey, clearGeminiKey, submitFeedback
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat deve ser usado dentro de <ChatProvider>');
  return ctx;
}
