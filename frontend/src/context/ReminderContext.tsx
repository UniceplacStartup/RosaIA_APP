import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { NewReminderInput, Reminder } from '../types/reminder';
import { INITIAL_REMINDERS } from '../data/seedData';
import { safeGetStorage, safeSetStorage, STORAGE_KEYS } from '../utils/storage';
import { api, getStoredToken } from '../services/api';
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

function getInitialRemindersForUser(user: { email?: string } | null): Reminder[] {
  if (user?.email === 'maria.silva@exemplo.com') {
    return [...INITIAL_REMINDERS];
  }
  return [];
}

export function ReminderProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const { user, isAuthenticated, accountResetToken } = useAuth();

  const getUserReminderKey = useCallback((email?: string) => {
    return email ? `${STORAGE_KEYS.reminders}_${email.trim().toLowerCase()}` : STORAGE_KEYS.reminders;
  }, []);

  const [reminders, setReminders] = useState<Reminder[]>(() => {
    const key = user?.email ? `${STORAGE_KEYS.reminders}_${user.email.trim().toLowerCase()}` : STORAGE_KEYS.reminders;
    return safeGetStorage<Reminder[]>(key, getInitialRemindersForUser(user), isReminderList);
  });
  const remindersRef = useRef(reminders);

  /** Atualiza estado + persistência específica da usuária. */
  const commit = useCallback(
    (next: Reminder[], persist = true) => {
      remindersRef.current = next;
      setReminders(next);
      if (persist) {
        const key = getUserReminderKey(user?.email);
        safeSetStorage(key, next);
      }
    },
    [getUserReminderKey, user?.email],
  );

  // Sincroniza os lembretes da usuária autenticada
  useEffect(() => {
    const token = getStoredToken();
    const storageKey = getUserReminderKey(user?.email);

    if (token && isAuthenticated) {
      api.reminders
        .list()
        .then((items) => {
          if (items && items.length > 0) {
            const mapped: Reminder[] = items.map((r) => ({
              id: r.id,
              tipo: (r.reminder_type as Reminder['tipo']) || 'exame',
              titulo: r.title,
              data: r.scheduled_for.split('T')[0] || r.scheduled_for,
              concluido: r.is_completed,
            }));
            commit(mapped, true);
            return;
          }
          const fresh = getInitialRemindersForUser(user);
          commit(fresh, true);
        })
        .catch(() => {
          const local = safeGetStorage<Reminder[]>(storageKey, getInitialRemindersForUser(user), isReminderList);
          commit(local, false);
        });
    } else {
      const local = safeGetStorage<Reminder[]>(storageKey, getInitialRemindersForUser(user), isReminderList);
      commit(local, false);
    }
  }, [user?.email, isAuthenticated, getUserReminderKey, commit]);

  // Exclusão de conta (LGPD): limpa estado sem regravar o storage.
  const lastResetToken = useRef(accountResetToken);
  useEffect(() => {
    if (lastResetToken.current === accountResetToken) return;
    lastResetToken.current = accountResetToken;
    commit(getInitialRemindersForUser(null), false);
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

      // Tenta persistir no Neon via API
      const token = getStoredToken();
      if (token) {
        api.reminders
          .create({
            reminder_type: tipo,
            title: cleanTitle,
            scheduled_for: new Date(data).toISOString(),
          })
          .catch(() => {
            // Mantém no storage local caso offline
          });
      }

      showToast('Lembrete Criado', 'Notificação programada com sucesso.', 'success');
      return true;
    },
    [commit, showToast],
  );

  const toggleReminder = useCallback(
    (id: string) => {
      const updated = remindersRef.current.map((r) => (r.id === id ? { ...r, concluido: !r.concluido } : r));
      commit(updated);

      const target = updated.find((r) => r.id === id);
      const token = getStoredToken();
      if (token && target && !id.startsWith('rem_')) {
        api.reminders.toggle(id, target.concluido).catch(() => {});
      }
    },
    [commit],
  );

  const removeReminder = useCallback(
    (id: string) => {
      commit(remindersRef.current.filter((r) => r.id !== id));
      const token = getStoredToken();
      if (token && !id.startsWith('rem_')) {
        api.reminders.delete(id).catch(() => {});
      }
      showToast('Lembrete Removido', 'O lembrete foi excluído da sua lista.', 'info');
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
