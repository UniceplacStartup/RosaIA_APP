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
import { safeGetStorage, safeSetStorage, STORAGE_KEYS } from '../utils/storage';
import { api, getStoredToken } from '../services/api';
import type { TriageInput } from '../types/triage';
import { AGE_RANGE_OPTIONS, cleanRosaFormatting, generateTriageDoctorResponse } from '../utils/triageClassifier';
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

  // Exclusão de conta (LGPD): restaura estado inicial sem regravar o storage.
  const lastResetToken = useRef(accountResetToken);
  useEffect(() => {
    if (lastResetToken.current === accountResetToken) return;
    lastResetToken.current = accountResetToken;
    commitMessages(getInitialMessagesForUser(null), false);
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
      // Atualiza o estado local imediatamente
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

      let rawContent = '';
      const isTextualDoc = /\.(pdf|txt|doc|docx)$/i.test(file.name);
      if (isTextualDoc) {
        try {
          rawContent = await file.text();
        } catch {
          rawContent = '';
        }
      }
      const preview = isTextualDoc ? buildAnonymizedPreview(rawContent) : 'Exame de imagem recebido com higienização de dados pessoais.';

      const token = getStoredToken();
      if (token && !offlineRef.current) {
        try {
          showToast('Analisando Exame...', 'Processando documento e protegendo dados pessoais...', 'info');
          const uploadRes = await api.upload.uploadDocument(file);
          showToast('🔬 Exame Analisado', 'Laudo processado com sucesso pela Doutora Rosa!', 'success');

          const explanation = uploadRes.ai_educational_analysis
            ? `Doutora Rosa, enviei meu exame (${file.name}). Análise descritiva do laudo: ${uploadRes.ai_educational_analysis}. Gostaria de tirar algumas dúvidas com você sobre o que isso significa.`
            : `Doutora Rosa, enviei meu exame (${file.name}). Trecho descritivo desidentificado: "${uploadRes.anonymized_preview || preview}". Gostaria de conversar com você sobre esses termos.`;

          await sendMessage(explanation, file.name);
          return;
        } catch {
          // Se upload na API falhar, cai no fluxo local
        }
      }

      showToast('🔬 Exame Processado (LGPD)', 'Dados pessoais protegidos. Análise descritiva pronta para conversa.', 'success');
      await sendMessage(
        `Doutora Rosa, enviei meu exame (${file.name}). Descrição desidentificada: "${preview || 'Exame de imagem mamária anexado para leitura educativa'}". Pode me explicar os achados descritivos com calma para que eu tire minhas dúvidas?`,
        file.name,
      );
    },
    [sendMessage, showToast],
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
      const symptomsText = input.symptoms.length > 0 ? input.symptoms.join(', ') : 'Nenhum sintoma observado';
      const ageLabel = AGE_RANGE_OPTIONS.find((o) => o.value === input.ageRange)?.label || input.ageRange;
      const familyText = input.familyHistory === 'sim' ? 'Sim (Mãe, irmã ou filha)' : 'Não';
      const userMessageText = `Doutora Rosa, realizei minha Triagem de Atenção Mamária no aplicativo com os seguintes dados:\n• Faixa Etária: ${ageLabel}\n• Histórico Familiar de 1º Grau: ${familyText}\n• Sinais ou Sintomas Relatados: ${symptomsText}\n\nGostaria da sua avaliação acolhedora e personalizada sobre o meu caso.`;

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
        api.triage
          .assess({
            age_range: input.ageRange,
            has_family_history: input.familyHistory === 'sim',
            reported_signs: input.symptoms,
            emotional_impact_level: input.symptoms.length > 0 ? 3 : 1,
          })
          .catch(() => {});
      }
    },
    [commitMessages],
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
      sendMessage, submitTriageToChat, retryLastMessage, toggleOfflineSimulation, uploadExamFile, simulateSampleDocument,
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
