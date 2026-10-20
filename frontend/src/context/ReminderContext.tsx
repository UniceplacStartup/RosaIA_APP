import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { NewReminderInput, Reminder } from '../types/reminder';
import { INITIAL_REMINDERS } from '../data/seedData';
import { safeGetStorage, safeSetStorage, STORAGE_KEYS } from '../utils/storage';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

interface ReminderContextValue {
  reminders: Reminder[];
  addReminder: (input: NewReminderInput) => boolean;
  toggleReminder: (id: string) => void;
  removeReminder: (id: string) => void;
}

const ReminderContext = createContext<ReminderContextValue | undefined>(undefined);

function isReminderList(value: unknown): value is Reminder[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Record<string, unknown>).id === 'string' &&
        typeof (item as Record<string, unknown>).titulo === 'string',
    )
  );
}

export function ReminderProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const { accountResetToken } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>(() =>
    safeGetStorage<Reminder[]>(STORAGE_KEYS.reminders, [...INITIAL_REMINDERS], isReminderList),
  );
  const remindersRef = useRef(reminders);

  /** Atualiza estado + persistência de forma síncrona e determinística. */
  const commit = useCallback((next: Reminder[], persist = true) => {
    remindersRef.current = next;
    setReminders(next);
    if (persist) safeSetStorage(STORAGE_KEYS.reminders, next);
  }, []);

  // Exclusão de conta (LGPD): volta ao estado inicial sem regravar o storage.
  const lastResetToken = useRef(accountResetToken);
  useEffect(() => {
    if (lastResetToken.current === accountResetToken) return;
    lastResetToken.current = accountResetToken;
    commit([...INITIAL_REMINDERS], false);
  }, [accountResetToken, commit]);

  const addReminder = useCallback(
    ({ tipo, titulo, data }: NewReminderInput): boolean => {
      const cleanTitle = titulo.trim();
      if (!cleanTitle || !data) {
        showToast('Preencha o Lembrete', 'Informe o título e a data do lembrete.', 'warning');
        return false;
      }
      const reminder: Reminder = { id: `rem_${Date.now()}`, tipo, titulo: cleanTitle, data, concluido: false };
      commit([reminder, ...remindersRef.current]);
      showToast('Lembrete Criado (RF11)', 'Notificação programada com sucesso.', 'success');
      return true;
    },
    [commit, showToast],
  );

  const toggleReminder = useCallback(
    (id: string) => {
      commit(remindersRef.current.map((r) => (r.id === id ? { ...r, concluido: !r.concluido } : r)));
    },
    [commit],
  );

  const removeReminder = useCallback(
    (id: string) => {
      commit(remindersRef.current.filter((r) => r.id !== id));
      showToast('Lembrete Removido (RF11)', 'O lembrete foi excluído da sua lista.', 'info');
    },
    [commit, showToast],
  );

  const value = useMemo(
    () => ({ reminders, addReminder, toggleReminder, removeReminder }),
    [reminders, addReminder, toggleReminder, removeReminder],
  );

  return <ReminderContext.Provider value={value}>{children}</ReminderContext.Provider>;
}

export function useReminders(): ReminderContextValue {
  const ctx = useContext(ReminderContext);
  if (!ctx) throw new Error('useReminders deve ser usado dentro de <ReminderProvider>');
  return ctx;
}
