import type { AssistantReply } from '../types/chat';
import { cleanRosaFormatting } from '../utils/triageClassifier';

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3-flash-preview'];

const SYSTEM_PROMPT =
  'Você é a Doutora Rosa do RosaIA APP (UNICEPLAC). Responda em português com calor humano, acolhimento, empatia, sinceridade e objetividade. Quando analisar uma imagem médica (DICOM ou convencional) ou qualquer outra imagem, avalie a imagem individualmente, descrevendo de forma objetiva e específica o que está visível nela (modalidade, região anatômica, incidência, padrão de densidade/ecogenicidade/atenuação, distribuição nos quadrantes e achados aparentes), SEM dar palestras genéricas sobre BI-RADS. Lembre sempre que você não substitui uma consulta médica presencial. REGRA ESTRITA DE FORMATAÇÃO: NUNCA use asteriscos (*) nem hashtags (#). Mensagem da usuária: ';

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
 * Integração opcional com o Google AI Studio (Gemini), com suporte multimodal (texto + imagem).
 * Retorna `null` em qualquer falha (rede, cota, chave inválida) para que o
 * chamador use a análise específica local como contingência.
 * Limpa asteriscos e hashtags da resposta.
 */
export async function askGemini(
  apiKey: string,
  userText: string,
  inlineImage?: { base64: string; mimeType: string },
): Promise<AssistantReply | null> {
  const parts: Array<Record<string, unknown>> = [];
  if (inlineImage?.base64) {
    parts.push({
      inline_data: {
        mime_type: inlineImage.mimeType || 'image/jpeg',
        data: inlineImage.base64,
      },
    });
  }
  parts.push({ text: SYSTEM_PROMPT + userText });

  for (const model of GEMINI_MODELS) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey.trim(),
        },
        body: JSON.stringify({
          contents: [{ parts }],
        }),
      });
      if (!response.ok) continue;

      const data = (await response.json()) as GeminiGenerateResponse;
      const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (aiText) {
        return { emotionTag: 'Gemini Vision Live • Doutora Rosa', text: cleanRosaFormatting(aiText) };
      }
    } catch {
      continue;
    }
  }
  return null;
}
