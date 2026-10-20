import { useEffect } from 'react';
import type { ReactNode } from 'react';

interface ModalShellProps {
  id: string;
  titleId: string;
  panelClassName: string;
  onClose: () => void;
  children: ReactNode;
}

/** Estrutura base acessível dos modais (backdrop, role=dialog e fechamento por Esc). */
export default function ModalShell({ id, titleId, panelClassName, onClose, children }: ModalShellProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      id={id}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={panelClassName}>
        {children}
      </div>
    </div>
  );
}
