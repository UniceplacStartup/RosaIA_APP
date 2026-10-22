import { useReminders } from '../../context/ReminderContext';
import type { Reminder } from '../../types/reminder';
import { createGoogleCalendarUrl, downloadAppleCalendarIcs } from '../../utils/calendarIntegration';

interface ReminderItemProps {
  reminder: Reminder;
}

const FREQUENCY_LABEL: Record<string, string> = {
  unica: 'Uma vez',
  diaria: 'Diariamente',
  semanal: 'Semanalmente',
  mensal: 'Mensalmente',
  anual: 'Anualmente',
};

/** Item de lembrete com checklist, detalhes de frequência e sincronização rápida Google/iOS. */
export default function ReminderItem({ reminder }: ReminderItemProps) {
  const { toggleReminder, removeReminder } = useReminders();

  const handleOpenGoogle = () => {
    window.open(createGoogleCalendarUrl(reminder), '_blank', 'noopener,noreferrer');
  };

  const handleDownloadIos = () => {
    downloadAppleCalendarIcs(reminder);
  };

  const freqText = reminder.recorrencia && reminder.recorrencia !== 'unica' ? ` • ${FREQUENCY_LABEL[reminder.recorrencia] || reminder.recorrencia}` : '';
  const timeText = reminder.hora ? ` às ${reminder.hora}` : '';

  return (
    <div className="p-3 rounded-xl border border-rosa-200 bg-rosa-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
      <div className="flex items-start sm:items-center gap-2.5">
        <input
          type="checkbox"
          data-rem-toggle={reminder.id}
          aria-label={`Concluir lembrete: ${reminder.titulo}`}
          checked={reminder.concluido}
          onChange={() => toggleReminder(reminder.id)}
          className="accent-rosa-800 w-4 h-4 cursor-pointer mt-0.5 sm:mt-0"
        />
        <div>
          <div className={`font-bold text-rosa-900 ${reminder.concluido ? 'line-through opacity-60' : ''}`}>
            [{reminder.tipo}] {reminder.titulo}
          </div>
          <div className="text-[11px] text-gray-500">
            Agendado para: <span className="font-semibold">{reminder.data}{timeText}</span>
            {freqText && <span className="text-rosa-800 font-semibold">{freqText}</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center">
        <button
          type="button"
          onClick={handleOpenGoogle}
          title="Adicionar ao Google Agenda"
          className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-semibold transition flex items-center gap-1"
        >
          <span>📅 Google</span>
        </button>

        <button
          type="button"
          onClick={handleDownloadIos}
          title="Salvar no Calendário iOS (.ics)"
          className="px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 text-[11px] font-semibold transition flex items-center gap-1"
        >
          <span>🍎 iOS</span>
        </button>

        <button
          type="button"
          data-rem-del={reminder.id}
          onClick={() => removeReminder(reminder.id)}
          className="text-red-600 hover:underline font-semibold text-[11px] px-1.5 py-1"
        >
          Excluir
        </button>
      </div>
    </div>
  );
}
