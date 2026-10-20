import { useState } from 'react';
import type { FormEvent } from 'react';
import { useReminders } from '../../context/ReminderContext';
import { DEFAULT_REMINDER_DATE } from '../../data/seedData';
import type { ReminderType } from '../../types/reminder';

const REMINDER_TYPE_OPTIONS: ReadonlyArray<{ value: ReminderType; label: string }> = [
  { value: 'Exame', label: '🔬 Exame' },
  { value: 'Consulta', label: '👩‍⚕️ Consulta' },
  { value: 'Medicação', label: '💊 Medicação' },
  { value: 'Autocuidado', label: '🌿 Autocuidado' },
];

/** Cadastro de novo lembrete de saúde. */
export default function ReminderForm() {
  const { addReminder } = useReminders();
  const [tipo, setTipo] = useState<ReminderType>('Exame');
  const [titulo, setTitulo] = useState('');
  const [data, setData] = useState(DEFAULT_REMINDER_DATE);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (addReminder({ tipo, titulo, data })) setTitulo('');
  };

  return (
    <form id="formLembrete" className="grid grid-cols-1 sm:grid-cols-3 gap-2.5" onSubmit={handleSubmit}>
      <select
        id="lembreteTipo"
        aria-label="Tipo de lembrete"
        value={tipo}
        onChange={(e) => setTipo(e.target.value as ReminderType)}
        className="px-3 py-2 rounded-xl border border-rosa-300 text-xs bg-white font-semibold"
      >
        {REMINDER_TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <input
        id="lembreteTitulo"
        type="text"
        aria-label="Título do lembrete"
        placeholder="Ex: Mamografia anual"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        className="px-3 py-2 rounded-xl border border-rosa-300 text-xs"
      />
      <div className="flex gap-2">
        <input
          id="lembreteData"
          type="date"
          aria-label="Data do lembrete"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="flex-1 px-2.5 py-2 rounded-xl border border-rosa-300 text-xs"
        />
        <button
          type="submit"
          className="px-4 py-2 rounded-xl bg-rosa-800 hover:bg-rosa-900 text-white font-bold text-xs shrink-0"
        >
          + Criar
        </button>
      </div>
    </form>
  );
}
