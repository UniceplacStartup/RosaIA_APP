import type { AssistantReply } from '../types/chat';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT =
  'Você é a Doutora Rosa do RosaIA APP (UNICEPLAC). Responda em português de forma acolhedora, empática, clara, reforçando que o câncer de mama tem tratamento e altas chances de cura na detecção precoce, e lembre que não substitui consulta médica. Mensagem da usuária: ';

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

export const MIN_GEMINI_KEY_LENGTH = 10;

/** Indica se a chave configurada é plausível para tentar a chamada em nuvem. */
export function isGeminiKeyUsable(apiKey: string): boolean {
  return apiKey.trim().length > MIN_GEMINI_KEY_LENGTH;
}

/**
 * Integração opcional com o Google AI Studio (Gemini).
 * Retorna `null` em qualquer falha (rede, cota, chave inválida) para que o
 * chamador use o motor RAG local como contingência.
 * A chave é enviada via cabeçalho (nunca na URL).
 */
export async function askGemini(apiKey: string, userText: string): Promise<AssistantReply | null> {
  try {
    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey.trim(),
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: SYSTEM_PROMPT + userText }] }],
      }),
    });
    if (!response.ok) return null;

    const data = (await response.json()) as GeminiGenerateResponse;
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return aiText ? { emotionTag: 'Gemini API Live • Doutora Rosa', text: aiText } : null;
  } catch {
    return null;
  }
}
