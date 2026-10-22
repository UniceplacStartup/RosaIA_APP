export type ReminderType = 'Exame' | 'Consulta' | 'Medicação' | 'Autocuidado';

export type ReminderFrequency = 'unica' | 'diaria' | 'semanal' | 'mensal' | 'anual';

export type ReminderAdvanceNotice = 'no_horario' | '15_min' | '1_hora' | '1_dia' | '2_dias' | '1_semana';

/**
 * Lembrete de saúde com campos detalhados para frequência e horários específicos.
 */
export interface Reminder {
  id: string;
  tipo: ReminderType;
  titulo: string;
  /** Data ISO `aaaa-mm-dd` */
  data: string;
  /** Horário específico `hh:mm` (ex: "08:30") */
  hora?: string;
  /** Quando ser lembrada (antecedência do alarme) */
  quandoLembrar?: ReminderAdvanceNotice;
  /** Frequência/recorrência (semanal, mensal, etc.) */
  recorrencia?: ReminderFrequency;
  concluido: boolean;
}

export interface NewReminderInput {
  tipo: ReminderType;
  titulo: string;
  data: string;
  hora?: string;
  quandoLembrar?: ReminderAdvanceNotice;
  recorrencia?: ReminderFrequency;
}
