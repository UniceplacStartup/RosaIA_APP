import { useState } from 'react';
import type { FormEvent } from 'react';
import { useChat } from '../../context/ChatContext';
import { useToast } from '../../context/ToastContext';
import { useUi } from '../../context/UiContext';
import type { AgeRange, FamilyHistory, RiskLevel, TriageAssessment } from '../../types/triage';
import { AGE_RANGE_OPTIONS, classifyTriage, SYMPTOM_OPTIONS } from '../../utils/triageClassifier';

const RESULT_TONE: Record<RiskLevel, string> = {
  rotina_preventiva: 'bg-emerald-50 border-emerald-300 text-emerald-900',
  atencao_moderada: 'bg-rosa-100 border-rosa-300 text-rosa-900',
  avaliacao_prioritaria: 'bg-amber-50 border-amber-300 text-amber-900',
};

/** Triagem inteligente de atenção mamária (RF10) — acolhedora, humana e integrada ao chat. */
export default function TriageSection() {
  const { showToast } = useToast();
  const { submitTriageToChat } = useChat();
  const { setActiveTab } = useUi();
  const [ageRange, setAgeRange] = useState<AgeRange>('50_69');
  const [familyHistory, setFamilyHistory] = useState<FamilyHistory>('nao');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [assessment, setAssessment] = useState<TriageAssessment | null>(null);

  const toggleSymptom = (value: string) => {
    setSymptoms((prev) => (prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = { ageRange, familyHistory, symptoms };
    const result = classifyTriage(input);
    setAssessment(result);

    // 1. Gera a mensagem e resposta acolhedora no chat baseada na triagem
    submitTriageToChat(input);

    // 2. Transporta automaticamente a paciente para o chat
    setActiveTab('chat');

    // 3. Notificação acolhedora
    showToast(
      'Triagem Concluída!',
      'Você foi conectada ao chat. A Doutora Rosa já preparou sua avaliação acolhedora!',
      'success',
    );
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-rosa-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-rosa-800">🩺 Triagem de Atenção Mamária</h2>
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-rosa-100 text-rosa-800 font-semibold">
          Educativo • Acolhimento Humanizado
        </span>
      </div>
      <p className="text-xs text-gray-600">
        Responda às perguntas abaixo para que a Doutora Rosa prepare uma avaliação empática, humana e específica
        diretamente no seu chat.
      </p>

      <form id="formTriagem" className="space-y-3.5" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="triagemIdade" className="block text-xs font-semibold text-rosa-900 mb-1">
            Faixa Etária
          </label>
          <select
            id="triagemIdade"
            value={ageRange}
            onChange={(e) => setAgeRange(e.target.value as AgeRange)}
            className="w-full px-3 py-2 rounded-xl border border-rosa-300 text-sm bg-white"
          >
            {AGE_RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend className="block text-xs font-semibold text-rosa-900 mb-1">
            Histórico Familiar de Câncer de Mama ou Ovário (1º grau)?
          </legend>
          <div className="flex gap-4 text-xs">
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="triagemHist"
                value="nao"
                checked={familyHistory === 'nao'}
                onChange={() => setFamilyHistory('nao')}
                className="accent-rosa-800 cursor-pointer"
              />{' '}
              Não
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="triagemHist"
                value="sim"
                checked={familyHistory === 'sim'}
                onChange={() => setFamilyHistory('sim')}
                className="accent-rosa-800 cursor-pointer"
              />{' '}
              Sim (Mãe, irmã ou filha)
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend className="block text-xs font-semibold text-rosa-900 mb-1">
            Sinais ou Sintomas Observados Recentemente:
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {SYMPTOM_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 p-2 rounded-lg bg-rosa-50 border border-rosa-200 cursor-pointer hover:bg-rosa-100/70 transition"
              >
                <input
                  type="checkbox"
                  value={option.value}
                  checked={symptoms.includes(option.value)}
                  onChange={() => toggleSymptom(option.value)}
                  className="triagem-sintoma accent-rosa-800 cursor-pointer"
                />{' '}
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="submit"
          className="w-full py-3 rounded-full bg-rosa-800 hover:bg-rosa-900 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2"
        >
          <span>💬 Gerar Orientação de Triagem e Ir para o Chat</span>
        </button>
      </form>

      {assessment && (
        <div
          id="triagemResultadoBox"
          role="status"
          className={`p-4 rounded-2xl border text-xs space-y-1.5 ${RESULT_TONE[assessment.level]}`}
        >
          <div className="font-extrabold text-sm">Resultado da Triagem: {assessment.label}</div>
          <div className="whitespace-pre-line leading-relaxed">{assessment.guidance}</div>
        </div>
      )}
    </div>
  );
}
