import type { Reminder } from '../types/reminder';

/** Formata data/hora para padrão iCalendar / Google (AAAAMMDDTHHmmssZ). */
function formatToCalDateTime(dateStr: string, timeStr = '08:00', durationMinutes = 60): { start: string; end: string } {
  const parts = dateStr.split('-').map(Number);
  const year = parts[0] ?? new Date().getFullYear();
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;

  const timeParts = (timeStr || '08:00').split(':').map(Number);
  const hours = timeParts[0] ?? 8;
  const minutes = timeParts[1] ?? 0;

  const startDate = new Date(year, month - 1, day, hours, minutes);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

  const pad = (n: number) => String(n).padStart(2, '0');

  const startFormatted = `${startDate.getFullYear()}${pad(startDate.getMonth() + 1)}${pad(startDate.getDate())}T${pad(
    startDate.getHours(),
  )}${pad(startDate.getMinutes())}00`;

  const endFormatted = `${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(endDate.getDate())}T${pad(
    endDate.getHours(),
  )}${pad(endDate.getMinutes())}00`;

  return { start: startFormatted, end: endFormatted };
}

/** Mapeia a frequência para a regra RRULE do Google Calendar e iCal. */
export function getRRule(recorrencia?: string): string {
  switch (recorrencia) {
    case 'diaria':
      return 'RRULE:FREQ=DAILY';
    case 'semanal':
      return 'RRULE:FREQ=WEEKLY';
    case 'mensal':
      return 'RRULE:FREQ=MONTHLY';
    case 'anual':
      return 'RRULE:FREQ=YEARLY';
    default:
      return '';
  }
}

/** Mapeia o gatilho de alarme iCal baseado na antecedência. */
function getAlarmTrigger(quandoLembrar?: string): string {
  switch (quandoLembrar) {
    case '15_min':
      return '-PT15M';
    case '1_hora':
      return '-PT1H';
    case '1_dia':
      return '-P1D';
    case '2_dias':
      return '-P2D';
    case '1_semana':
      return '-P1W';
    default:
      return '-PT0M';
  }
}

/** Gera a URL direta para adicionar o lembrete ao Google Agenda. */
export function createGoogleCalendarUrl(reminder: Reminder): string {
  const { start, end } = formatToCalDateTime(reminder.data, reminder.hora);
  const title = encodeURIComponent(`[RosaIA] ${reminder.tipo}: ${reminder.titulo}`);
  const details = encodeURIComponent(
    `Lembrete de saúde mamária cadastrado no RosaIA APP.\nTipo: ${reminder.tipo}\nDoutora Rosa - Acolhimento e Prevenção.`,
  );
  const rrule = getRRule(reminder.recorrencia);

  let url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}`;
  if (rrule) {
    url += `&recur=${encodeURIComponent(rrule)}`;
  }
  return url;
}

/** Gera e faz o download automático de um arquivo .ics compatível com o Apple Calendar (iOS/macOS). */
export function downloadAppleCalendarIcs(reminder: Reminder): void {
  const { start, end } = formatToCalDateTime(reminder.data, reminder.hora);
  const rrule = getRRule(reminder.recorrencia);
  const alarmTrigger = getAlarmTrigger(reminder.quandoLembrar);

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RosaIA APP//Doutora Rosa//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:rosaia_${reminder.id}_${Date.now()}@rosaia.app`,
    `DTSTAMP:${start}Z`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:[RosaIA] ${reminder.tipo}: ${reminder.titulo}`,
    `DESCRIPTION:Lembrete de saúde mamária - RosaIA APP (Doutora Rosa). Cuide-se com amor!`,
    rrule ? rrule : '',
    'BEGIN:VALARM',
    `TRIGGER:${alarmTrigger}`,
    'ACTION:DISPLAY',
    `DESCRIPTION:Lembrete RosaIA: ${reminder.titulo}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');

  const blob = new Blob([icsLines], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `rosaia_lembrete_${reminder.id}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
