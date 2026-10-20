import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Toast, ToastType } from '../types/ui';

const TOAST_VISIBLE_MS = 4800;
const TOAST_FADE_MS = 300;

interface ToastContextValue {
  toasts: Toast[];
  showToast: (title: string, message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const showToast = useCallback((title: string, message: string, type: ToastType = 'info') => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, title, message, type, leaving: false }]);

    const fadeTimer = window.setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      const removeTimer = window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, TOAST_FADE_MS);
      timers.current.push(removeTimer);
    }, TOAST_VISIBLE_MS);
    timers.current.push(fadeTimer);
  }, []);

  const value = useMemo(() => ({ toasts, showToast }), [toasts, showToast]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve ser usado dentro de <ToastProvider>');
  return ctx;
}
