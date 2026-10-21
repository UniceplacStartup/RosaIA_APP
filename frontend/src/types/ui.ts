export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  title: string;
  message: string;
  type: ToastType;
  /** true durante a animação de saída (fade) */
  leaving: boolean;
}

export type AppTab = 'chat' | 'triagem' | 'sobre' | 'perfil';
