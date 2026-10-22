import { useState } from 'react';
import type { FormEvent } from 'react';
import { useReminders } from '../../context/ReminderContext';
import { DEFAULT_REMINDER_DATE } from '../../data/seedData';
import type { Reminder, ReminderAdvanceNotice, ReminderFrequency, ReminderType } from '../../types/reminder';
import { createGoogleCalendarUrl, downloadAppleCalendarIcs } from '../../utils/calendarIntegration';

const REMINDER_TYPE_OPTIONS: ReadonlyArray<{ value: ReminderType; label: string }> = [
  { value: 'Exame', label: '🔬 Exame' },
  { value: 'Consulta', label: '👩‍⚕️ Consulta' },
  { value: 'Medicação', label: '💊 Medicação' },
  { value: 'Autocuidado', label: '🌿 Autocuidado' },
];

const ADVANCE_NOTICE_OPTIONS: ReadonlyArray<{ value: ReminderAdvanceNotice; label: string }> = [
  { value: 'no_horario', label: '⏰ No horário do lembrete' },
  { value: '15_min', label: '🔔 15 minutos antes' },
  { value: '1_hora', label: '🔔 1 hora antes' },
  { value: '1_dia', label: '📅 1 dia antes' },
  { value: '2_dias', label: '📅 2 dias antes' },
  { value: '1_semana', label: '🗓️ 1 semana antes' },
];

const FREQUENCY_OPTIONS: ReadonlyArray<{ value: ReminderFrequency; label: string }> = [
  { value: 'unica', label: 'Uma vez (Sem repetição)' },
  { value: 'semanal', label: 'Semanalmente' },
  { value: 'mensal', label: 'Mensalmente' },
  { value: 'diaria', label: 'Diariamente' },
  { value: 'anual', label: 'Anualmente' },
];

/** Cadastro de novo lembrete com frequência detalhada e sincronização automática com Google e iOS. */
export default function ReminderForm() {
  const { addReminder, lastCreatedReminder, clearLastCreatedReminder } = useReminders();
  const [tipo, setTipo] = useState<ReminderType>('Exame');
  const [titulo, setTitulo] = useState('');
  const [data, setData] = useState(DEFAULT_REMINDER_DATE);
  const [hora, setHora] = useState('09:00');
  const [quandoLembrar, setQuandoLembrar] = useState<ReminderAdvanceNotice>('1_dia');
  const [recorrencia, setRecorrencia] = useState<ReminderFrequency>('unica');
  const [justCreated, setJustCreated] = useState<Reminder | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const created = addReminder({
      tipo,
      titulo,
      data,
      hora,
      quandoLembrar,
      recorrencia,
    });
    if (created) {
      setTitulo('');
      setJustCreated(created);
    }
  };

  const handleOpenGoogle = (rem: Reminder) => {
    const url = createGoogleCalendarUrl(rem);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadIos = (rem: Reminder) => {
    downloadAppleCalendarIcs(rem);
  };

  const activeSyncReminder = justCreated || lastCreatedReminder;

  return (
    <div className="space-y-4">
      <form id="formLembrete" className="space-y-3 bg-white p-4 rounded-2xl border border-rosa-200" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label htmlFor="lembreteTipo" className="block text-[11px] font-bold text-rosa-900 mb-1">
              Tipo de Lembrete
            </label>
            <select
              id="lembreteTipo"
              aria-label="Tipo de lembrete"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as ReminderType)}
              className="w-full px-3 py-2 rounded-xl border border-rosa-300 text-xs bg-white font-semibold"
            >
              {REMINDER_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="lembreteTitulo" className="block text-[11px] font-bold text-rosa-900 mb-1">
              Título / Descrição do Lembrete
            </label>
            <input
              id="lembreteTitulo"
              type="text"
              aria-label="Título do lembrete"
              placeholder="Ex: Mamografia bilateral de rotina ou Consulta Mastologista"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-rosa-300 text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          <div>
            <label htmlFor="lembreteData" className="block text-[11px] font-bold text-rosa-900 mb-1">
              Data Agendada
            </label>
            <input
              id="lembreteData"
              type="date"
              aria-label="Data do lembrete"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl border border-rosa-300 text-xs"
            />
          </div>

          <div>
            <label htmlFor="lembreteHora" className="block text-[11px] font-bold text-rosa-900 mb-1">
              Horário Específico
            </label>
            <input
              id="lembreteHora"
              type="time"
              aria-label="Horário específico do lembrete"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl border border-rosa-300 text-xs"
            />
          </div>

          <div>
            <label htmlFor="lembreteQuandoLembrar" className="block text-[11px] font-bold text-rosa-900 mb-1">
              Quando ser lembrada?
            </label>
            <select
              id="lembreteQuandoLembrar"
              aria-label="Quando ser lembrada"
              value={quandoLembrar}
              onChange={(e) => setQuandoLembrar(e.target.value as ReminderAdvanceNotice)}
              className="w-full px-2.5 py-2 rounded-xl border border-rosa-300 text-xs bg-white"
            >
              {ADVANCE_NOTICE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="lembreteRecorrencia" className="block text-[11px] font-bold text-rosa-900 mb-1">
              Frequência / Recorrência
            </label>
            <select
              id="lembreteRecorrencia"
              aria-label="Recorrência do lembrete"
              value={recorrencia}
              onChange={(e) => setRecorrencia(e.target.value as ReminderFrequency)}
              className="w-full px-2.5 py-2 rounded-xl border border-rosa-300 text-xs bg-white"
            >
              {FREQUENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-rosa-800 hover:bg-rosa-900 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5"
          >
            <span>+ Criar Lembrete</span>
          </button>
        </div>
      </form>

      {/* Caixa de Sincronização Automática com Google Agenda e iOS */}
      {activeSyncReminder && (
        <div
          id="syncCalendarBox"
          role="region"
          aria-label="Sincronização de agendas"
          className="p-4 rounded-2xl bg-gradient-to-r from-rosa-50 via-white to-rosa-50 border-2 border-rosa-300 shadow-sm space-y-3 animate-fade-in"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                ✓ Lembrete Programado com Sucesso!
              </span>
              <h3 className="text-xs font-bold text-rosa-900 mt-1">
                [{activeSyncReminder.tipo}] {activeSyncReminder.titulo} ({activeSyncReminder.data} às{' '}
                {activeSyncReminder.hora || '08:00'})
              </h3>
              <p className="text-[11px] text-gray-600 mt-0.5">
                Sincronize com um clique diretamente na sua agenda do Google ou no calendário nativo do iOS / Apple:
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setJustCreated(null);
                clearLastCreatedReminder();
              }}
              className="text-gray-400 hover:text-gray-600 text-xs font-bold"
              title="Fechar"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              id="btnSyncGoogleCalendar"
              type="button"
              onClick={() => handleOpenGoogle(activeSyncReminder)}
              className="flex-1 min-w-[200px] py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow transition flex items-center justify-center gap-2"
            >
              <span>📅 Abrir no Google Agenda</span>
            </button>

            <button
              id="btnSyncAppleCalendar"
              type="button"
              onClick={() => handleDownloadIos(activeSyncReminder)}
              className="flex-1 min-w-[200px] py-2.5 px-4 rounded-xl bg-gray-900 hover:bg-black text-white font-bold text-xs shadow transition flex items-center justify-center gap-2"
            >
              <span>🍎 Salvar no Calendário iOS (.ics)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
