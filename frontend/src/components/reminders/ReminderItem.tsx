import { useReminders } from '../../context/ReminderContext';
import type { Reminder } from '../../types/reminder';

interface ReminderItemProps {
  reminder: Reminder;
}

/** Item de lembrete com checklist (toggle) e exclusão. */
export default function ReminderItem({ reminder }: ReminderItemProps) {
  const { toggleReminder, removeReminder } = useReminders();

  return (
    <div className="p-3 rounded-xl border border-rosa-200 bg-rosa-50/60 flex items-center justify-between gap-2 text-xs">
      <div className="flex items-center gap-2.5">
        <input
          type="checkbox"
          data-rem-toggle={reminder.id}
          aria-label={`Concluir lembrete: ${reminder.titulo}`}
          checked={reminder.concluido}
          onChange={() => toggleReminder(reminder.id)}
          className="accent-rosa-800 w-4 h-4 cursor-pointer"
        />
        <div>
          <div className={`font-bold text-rosa-900 ${reminder.concluido ? 'line-through opacity-60' : ''}`}>
            [{reminder.tipo}] {reminder.titulo}
          </div>
          <div className="text-[11px] text-gray-500">Agendado para: {reminder.data}</div>
        </div>
      </div>
      <button
        type="button"
        data-rem-del={reminder.id}
        onClick={() => removeReminder(reminder.id)}
        className="text-red-600 hover:underline font-semibold text-[11px]"
      >
        Excluir
      </button>
    </div>
  );
}
