/** Chaves de persistência (mantidas idênticas às do protótipo original). */
export const STORAGE_KEYS = {
  user: 'rosaia_user',
  messages: 'rosaia_messages',
  reminders: 'rosaia_reminders',
  geminiKey: 'rosaia_gemini_key',
} as const;

type Guard<T> = (value: unknown) => value is T;

/** Leitura segura do localStorage com fallback e validação opcional de formato. */
export function safeGetStorage<T>(key: string, fallback: T, guard?: Guard<T>): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (guard && !guard(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

/** Escrita segura (ignora falhas de quota / modo privado). */
export function safeSetStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sem persistência disponível */
  }
}

/** Exclusão permanente de todos os dados locais (LGPD Art. 18). */
export function clearAllStorage(): void {
  try {
    localStorage.clear();
  } catch {
    /* sem persistência disponível */
  }
}
