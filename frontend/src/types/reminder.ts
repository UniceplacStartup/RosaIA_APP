export type ReminderType = 'Exame' | 'Consulta' | 'Medicação' | 'Autocuidado';

/**
 * Lembrete de saúde. Os nomes dos campos seguem o formato persistido
 * no localStorage pelo protótipo original (compatibilidade retroativa).
 */
export interface Reminder {
  id: string;
  tipo: ReminderType;
  titulo: string;
  /** Data ISO `aaaa-mm-dd` */
  data: string;
  concluido: boolean;
}

export interface NewReminderInput {
  tipo: ReminderType;
  titulo: string;
  data: string;
}
