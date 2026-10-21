export type MessageSender = 'user' | 'doutora_rosa';

/** Rótulo cronológico do chip de data: `dd/mm/aaaa` ou `Hoje`. */
export type DateGroup = string;

export interface ChatMessage {
  id: string;
  dateGroup: DateGroup;
  time: string;
  sender: MessageSender;
  text: string;
  /** Rótulo de contexto emocional/clínico exibido no balão da Doutora Rosa */
  emotionTag?: string;
  /** Nome do documento anonimizado anexado (LGPD) */
  docAttachment?: string | null;
  /** Avaliação da usuária (1 para 👍, -1 para 👎) */
  userRating?: number | null;
  /** Telemetria da IA */
  aiModel?: string | null;
  usedFallback?: boolean;
  urgencyLevel?: string;
}

/** Sinais detectados no texto da usuária pelo motor RAG local. */
export interface EmotionalClinicalContext {
  hasFear: boolean;
  hasSymptom: boolean;
  hasExam: boolean;
}

export type EmotionTone = 'default' | 'attention' | 'support' | 'info';
export type EmotionExplanationKind = 'default' | 'fear_symptom';

/** Estado do painel "Monitor de Apoio Psicológico (RF07)". */
export interface EmotionMonitorState {
  badgeLabel: string;
  tone: EmotionTone;
  explanation: EmotionExplanationKind;
}

/** Resposta gerada pelo motor RAG local ou pelo Gemini. */
export interface AssistantReply {
  emotionTag: string;
  text: string;
  /** Quando presente, atualiza o monitor emocional (somente motor local) */
  monitorUpdate?: Partial<EmotionMonitorState>;
}

export type SampleDocumentKind = 'birads2' | 'birads3' | 'image_blocked';

export interface UploadedDocument {
  name: string;
  anonymizedPreview: string;
}

export type ExamRejectionReason = 'image_blocked' | 'unsupported_extension';

export type ExamValidationResult =
  | { ok: true }
  | { ok: false; reason: ExamRejectionReason };

export interface JumpRequest {
  dateGroup: DateGroup;
  nonce: number;
}
