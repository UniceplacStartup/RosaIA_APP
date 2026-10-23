/** Chaves base de persistência com suporte a isolamento por usuária. */
export const STORAGE_KEYS = {
  user: 'rosaia_user',
  messages: 'rosaia_messages',
  reminders: 'rosaia_reminders',
  triage: 'rosaia_triage',
  geminiKey: 'rosaia_gemini_key',
} as const;

type Guard<T> = (value: unknown) => value is T;

/** Retorna chave de armazenamento isolada por usuária. */
export function getUserStorageKey(baseKey: string, userIdentifier?: string | null): string {
  if (!userIdentifier) return baseKey;
  const clean = userIdentifier.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  return `${baseKey}_${clean}`;
}

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

/** Remove uma chave do localStorage com segurança. */
export function safeRemoveStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* sem persistência disponível */
  }
}

/** Limpa todas as informações de sessão da usuária no logout (LGPD). */
export function clearUserSessionStorage(userIdentifier?: string | null): void {
  try {
    if (userIdentifier) {
      safeRemoveStorage(getUserStorageKey(STORAGE_KEYS.messages, userIdentifier));
      safeRemoveStorage(getUserStorageKey(STORAGE_KEYS.reminders, userIdentifier));
      safeRemoveStorage(getUserStorageKey(STORAGE_KEYS.triage, userIdentifier));
    }
    safeRemoveStorage(STORAGE_KEYS.user);
    safeRemoveStorage(STORAGE_KEYS.messages);
    safeRemoveStorage(STORAGE_KEYS.reminders);
    safeRemoveStorage(STORAGE_KEYS.triage);
    sessionStorage.clear();
  } catch {
    /* sem persistência disponível */
  }
}

/** Exclusão permanente de todos os dados locais (LGPD Art. 18). */
export function clearAllStorage(): void {
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    /* sem persistência disponível */
  }
}

