import { useToast } from '../../context/ToastContext';
import type { ToastType } from '../../types/ui';

const TOAST_STYLES: Record<ToastType, string> = {
  success: 'bg-emerald-800 border-emerald-500 text-white',
  error: 'bg-red-800 border-red-400 text-white',
  warning: 'bg-amber-800 border-amber-400 text-white',
  info: 'bg-rosa-800 border-rosa-400 text-white',
};

/** Sistema de notificações customizado (substitui alert/confirm nativos). */
export default function ToastContainer() {
  const { toasts } = useToast();

  return (
    <div
      id="toastContainer"
      aria-live="polite"
      className="fixed top-14 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.type === 'error' ? 'alert' : 'status'}
          style={{ opacity: toast.leaving ? 0 : 1 }}
          className={`pointer-events-auto p-3.5 rounded-2xl border shadow-xl transition-all duration-300 ${TOAST_STYLES[toast.type]}`}
        >
          <div className="font-bold text-xs mb-0.5">{toast.title}</div>
          <div className="text-[11px] opacity-95 leading-snug">{toast.message}</div>
        </div>
      ))}
    </div>
  );
}
