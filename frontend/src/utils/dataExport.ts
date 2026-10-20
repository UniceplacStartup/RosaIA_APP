import type { ChatMessage } from '../types/chat';
import type { Reminder } from '../types/reminder';
import type { User } from '../types/auth';

export interface LgpdExportPayload {
  exportadoEm: string;
  base_legal: string;
  titular: Pick<User, 'fullName' | 'email' | 'cpfMasked'>;
  conversas: ChatMessage[];
  lembretes: Reminder[];
}

/** Monta o relatório de portabilidade (LGPD Art. 18, V). Nunca inclui hash de CPF nem chaves de API. */
export function buildLgpdExport(user: User, messages: ChatMessage[], reminders: Reminder[]): LgpdExportPayload {
  return {
    exportadoEm: new Date().toISOString(),
    base_legal: 'LGPD — Lei nº 13.709/2018, Art. 18 (Portabilidade dos dados)',
    titular: { fullName: user.fullName, email: user.email, cpfMasked: user.cpfMasked },
    conversas: messages,
    lembretes: reminders,
  };
}

/** Dispara o download de um arquivo JSON no navegador. */
export function downloadJson(fileName: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
