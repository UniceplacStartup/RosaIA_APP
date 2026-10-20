export const CPF_REDACTION_TOKEN = '[CPF_OCULTO_LGPD]';
export const EMAIL_REDACTION_TOKEN = '[EMAIL_OCULTO_LGPD]';

/** Sanitiza laudos médicos removendo PII (CPF e e-mail) antes da leitura pela IA. */
export function anonymizeExamText(rawText: string): string {
  return rawText
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, CPF_REDACTION_TOKEN)
    .replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, EMAIL_REDACTION_TOKEN);
}

// eslint-disable-next-line no-control-regex
const NON_PRINTABLE = /[\u0000-\u0008\u000B-\u001F\u007F\uFFFD]/g;

/**
 * Gera o trecho anonimizado exibido no chat. A anonimização é aplicada ao texto
 * completo ANTES do corte, evitando que um CPF cortado ao meio vaze parcialmente.
 */
export function buildAnonymizedPreview(rawText: string, maxLength = 400): string {
  const printable = rawText.replace(NON_PRINTABLE, '');
  return anonymizeExamText(printable).slice(0, maxLength).trim();
}
