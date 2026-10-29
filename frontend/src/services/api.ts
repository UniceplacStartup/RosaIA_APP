/**
 * Cliente HTTP unificado para a API FastAPI do RosaIA APP (UNICEPLAC).
 * Gerencia autenticação JWT (Bearer token), endpoints de segurança LGPD,
 * chat contínuo com Doutora Rosa, upload de laudos médicos e lembretes.
 */

const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ||
  'http://localhost:8000/api/v1';

const TOKEN_STORAGE_KEY = 'rosaia_access_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export interface ApiErrorResponse {
  error?: string;
  message?: string;
  detail?: string | Array<{ field?: string; msg?: string }>;
}

export class ApiError extends Error {
  status: number;
  data?: ApiErrorResponse;

  constructor(status: number, message: string, data?: ApiErrorResponse) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getStoredToken();

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      let errorData: ApiErrorResponse | undefined;
      let errorMsg = `Erro na requisição (${response.status})`;
      try {
        errorData = await response.json();
        if (errorData) {
          if (typeof errorData.detail === 'string') {
            errorMsg = errorData.detail;
          } else if (errorData.message) {
            errorMsg = errorData.message;
          } else if (Array.isArray(errorData.detail)) {
            errorMsg = errorData.detail.map((d) => d.msg || '').filter(Boolean).join('; ') || errorMsg;
          }
        }
      } catch {
        // Ignora erro de parse caso resposta não seja JSON
      }
      throw new ApiError(response.status, errorMsg, errorData);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  } catch (err: unknown) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, 'Servidor indisponível ou erro de conexão de rede.');
  }
}

// ==============================================================================
// Tipos de Request e Response da API
// ==============================================================================

export interface ApiUser {
  id: string;
  fullName?: string;
  full_name?: string;
  email: string;
  cpfMasked?: string;
  cpf_masked?: string;
  cpfHash?: string;
  cpf_hash?: string;
  role?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: ApiUser;
}

export interface ApiMessageResponse {
  id: string;
  date_group: string;
  time: string;
  sender: 'user' | 'doutora_rosa';
  text: string;
  emotion_tag?: string | null;
  doc_attachment?: string | null;
  psychological_support_triggered?: boolean;
  rag_references?: string[];
  created_at: string;
  ai_model?: string | null;
  used_fallback?: boolean;
  urgency_level?: string;
  user_rating?: number | null;
}

export interface ApiThreadDetail {
  thread_id: string;
  title: string;
  current_emotional_state: string;
  messages: ApiMessageResponse[];
}

export interface ApiTriageExchange {
  user_message: ApiMessageResponse;
  assistant_message: ApiMessageResponse;
}

export interface ApiAudioChatResponse {
  transcript: string;
  user_message: ApiMessageResponse;
  reply: ApiMessageResponse;
}

export interface ApiUploadResponse {
  document_id: string;
  filename: string;
  lgpd_anonymized?: boolean;
  extracted_preview?: string;
  birads_detected?: string | null;
  educational_interpretation?: string;
  image_kind?: string | null;
  user_message?: ApiMessageResponse | null;
  assistant_message?: ApiMessageResponse | null;
  medical_disclaimer?: string;
}

export interface ApiReminder {
  id: string;
  reminder_type: string;
  title: string;
  notes?: string | null;
  scheduled_for: string;
  is_completed: boolean;
  created_at: string;
}

export interface ApiTriagePayload {
  gender?: string;
  age_range: string;
  has_family_history: boolean;
  reported_signs: string[];
  emotional_impact_level?: number;
}

export interface ApiTriageResponse {
  attention_level: string;
  ai_guidance_summary: string;
  priority_score: number;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ==============================================================================
// Métodos da API
// ==============================================================================

export const api = {
  health: {
    check: () => request<{ status: string; app: string }>('/health'),
    readiness: () => request<{ status: string; database: string }>('/health/readiness'),
  },

  auth: {
    register: async (payload: {
      full_name: string;
      email: string;
      cpf: string;
      password: string;
      confirm_password?: string;
      accepted_terms?: boolean;
    }): Promise<AuthResponse> => {
      const res = await request<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (res.access_token) {
        setStoredToken(res.access_token);
      }
      return res;
    },

    login: async (payload: { identifier: string; password: string }): Promise<AuthResponse> => {
      const res = await request<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (res.access_token) {
        setStoredToken(res.access_token);
      }
      return res;
    },

    getProfile: () => request<{ user: ApiUser }>('/profile/me'),

    recoverPassword: (email: string) =>
      request<{ message: string }>('/auth/recover', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),

    checkCpf: (cpf: string) => {
      const clean = cpf.replace(/\D/g, '');
      return request<{ exists: boolean; message: string }>(`/auth/check-cpf?cpf=${encodeURIComponent(clean)}`);
    },

    checkEmail: (email: string) => {
      return request<{ exists: boolean; message: string }>(`/auth/check-email?email=${encodeURIComponent(email.trim())}`);
    },

    logout: () => {
      clearStoredToken();
    },
  },

  chat: {
    getHistory: () => request<ApiThreadDetail>('/chat/messages'),

    sendMessage: (content: string, attached_document_id?: string | null) => {
      const validUuid =
        typeof attached_document_id === 'string' && UUID_REGEX.test(attached_document_id.trim())
          ? attached_document_id.trim()
          : null;
      return request<ApiMessageResponse>('/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          content,
          attached_document_id: validUuid,
        }),
      });
    },

    saveTriageExchange: (user_text: string, assistant_text: string, emotion_tag?: string) =>
      request<ApiTriageExchange>('/chat/triage-exchange', {
        method: 'POST',
        body: JSON.stringify({ user_text, assistant_text, emotion_tag: emotion_tag || null }),
      }),

    sendAudio: (audio: Blob) => {
      const formData = new FormData();
      const ext = audio.type.includes('mp4') ? 'm4a' : audio.type.includes('ogg') ? 'ogg' : 'webm';
      formData.append('file', audio, `audio.${ext}`);
      return request<ApiAudioChatResponse>('/chat/audio', { method: 'POST', body: formData });
    },

    submitFeedback: (messageId: string, rating: number, comment?: string, allowTrainingUse: boolean = false) =>
      request<{ id: string; rating: number; review_status: string }>(`/chat/messages/${messageId}/feedback`, {
        method: 'POST',
        body: JSON.stringify({
          rating,
          comment: comment || null,
          allow_training_use: allowTrainingUse,
        }),
      }),

    getMetrics: () =>
      request<{
        total_messages: number;
        total_feedbacks: number;
        positive_feedbacks: number;
        negative_feedbacks: number;
        satisfaction_rate: number;
        fallback_rate: number;
        avg_latency_ms: number;
        active_kb_chunks: number;
        curated_kb_chunks: number;
      }>('/chat/metrics'),
  },

  upload: {
    uploadDocument: async (file: File): Promise<ApiUploadResponse> => {
      const formData = new FormData();
      formData.append('file', file);
      return request<ApiUploadResponse>('/upload/document', {
        method: 'POST',
        body: formData,
      });
    },
  },

  triage: {
    assess: (data: ApiTriagePayload) =>
      request<ApiTriageResponse>('/triage/assess', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  reminders: {
    list: () => request<ApiReminder[]>('/reminders'),
    create: (data: { reminder_type: string; title: string; notes?: string; scheduled_for: string }) =>
      request<ApiReminder>('/reminders', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    toggle: (id: string, is_completed: boolean) =>
      request<ApiReminder>(`/reminders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_completed }),
      }),
    delete: (id: string) =>
      request<void>(`/reminders/${id}`, {
        method: 'DELETE',
      }),
  },
};
