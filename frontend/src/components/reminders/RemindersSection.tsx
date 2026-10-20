import { useReminders } from '../../context/ReminderContext';
import ReminderForm from './ReminderForm';
import ReminderItem from './ReminderItem';

/** Container de Lembretes de Saúde: exames, consultas, medicações e autocuidado (RF11). */
export default function RemindersSection() {
  const { reminders } = useReminders();

  return (
    <div className="bg-white rounded-2xl p-5 border border-rosa-200 shadow-sm space-y-4">
      <h2 className="text-lg font-extrabold text-rosa-800">⏰ Meus Lembretes de Cuidado (RF11)</h2>
      <p className="text-xs text-gray-600">Agende lembretes de mamografia, ultrassom, consultas médicas ou medicações.</p>

      <ReminderForm />

      <div id="listaLembretes" className="space-y-2 max-h-72 overflow-y-auto custom-scroll">
        {reminders.map((reminder) => (
          <ReminderItem key={reminder.id} reminder={reminder} />
        ))}
      </div>
    </div>
  );
}
