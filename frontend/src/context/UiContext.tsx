import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AppTab } from '../types/ui';

type ModalName = 'gemini' | 'logout' | 'deleteAccount';

interface UiContextValue {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  isModalOpen: (modal: ModalName) => boolean;
  openModal: (modal: ModalName) => void;
  closeModal: (modal: ModalName) => void;
}

const UiContext = createContext<UiContextValue | undefined>(undefined);

/** Estado puramente visual compartilhado: aba ativa e modais globais. */
export function UiProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<AppTab>('chat');
  const [openModals, setOpenModals] = useState<ReadonlySet<ModalName>>(new Set());

  const openModal = useCallback((modal: ModalName) => {
    setOpenModals((prev) => new Set(prev).add(modal));
  }, []);

  const closeModal = useCallback((modal: ModalName) => {
    setOpenModals((prev) => {
      const next = new Set(prev);
      next.delete(modal);
      return next;
    });
  }, []);

  const isModalOpen = useCallback((modal: ModalName) => openModals.has(modal), [openModals]);

  const value = useMemo(
    () => ({ activeTab, setActiveTab, isModalOpen, openModal, closeModal }),
    [activeTab, isModalOpen, openModal, closeModal],
  );

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): UiContextValue {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi deve ser usado dentro de <UiProvider>');
  return ctx;
}
