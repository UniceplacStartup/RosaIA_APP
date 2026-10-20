import { useState } from 'react';
import type { FormEvent } from 'react';
import { useChat } from '../../context/ChatContext';
import { useToast } from '../../context/ToastContext';
import type { AgeRange, FamilyHistory, RiskLevel, TriageAssessment } from '../../types/triage';
import { AGE_RANGE_OPTIONS, classifyTriage, SYMPTOM_OPTIONS } from '../../utils/triageClassifier';

const RESULT_TONE: Record<RiskLevel, string> = {
  rotina_preventiva: 'bg-emerald-50 border-emerald-300 text-emerald-900',
  atencao_moderada: 'bg-rosa-100 border-rosa-300 text-rosa-900',
  avaliacao_prioritaria: 'bg-amber-50 border-amber-300 text-amber-900',
};

/** Triagem inteligente de atenção mamária (RF10) — educativa, não diagnóstica. */
export default function TriageSection() {
  const { showToast } = useToast();
  const { appendAssistantMessage } = useChat();
  const [ageRange, setAgeRange] = useState<AgeRange>('50_69');
  const [familyHistory, setFamilyHistory] = useState<FamilyHistory>('nao');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [assessment, setAssessment] = useState<TriageAssessment | null>(null);

  const toggleSymptom = (value: string) => {
    setSymptoms((prev) => (prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = classifyTriage({ ageRange, familyHistory, symptoms });
    setAssessment(result);
    appendAssistantMessage(
      'Triagem Inteligente • RF10',
      `Resultado da Triagem (RF10): ${result.label}\n${result.guidance}`,
    );
    showToast('Triagem Registrada (RF10)', 'Resumo enviado também para a sua conversa com a Doutora Rosa!', 'success');
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-rosa-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-rosa-800">🩺 Triagem Inteligente de Atenção Mamária (RF10)</h2>
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-rosa-100 text-rosa-800 font-semibold">
          Educativo • Não Diagnóstico
        </span>
      </div>
      <p className="text-xs text-gray-600">
        Responda rapidamente para receber uma orientação personalizada da Doutora Rosa sobre prevenção e necessidade de
        avaliação médica.
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
            <label className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                name="triagemHist"
                value="nao"
                checked={familyHistory === 'nao'}
                onChange={() => setFamilyHistory('nao')}
                className="accent-rosa-800"
              />{' '}
              Não
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                name="triagemHist"
                value="sim"
                checked={familyHistory === 'sim'}
                onChange={() => setFamilyHistory('sim')}
                className="accent-rosa-800"
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
                className="flex items-center gap-2 p-2 rounded-lg bg-rosa-50 border border-rosa-200"
              >
                <input
                  type="checkbox"
                  value={option.value}
                  checked={symptoms.includes(option.value)}
                  onChange={() => toggleSymptom(option.value)}
                  className="triagem-sintoma accent-rosa-800"
                />{' '}
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="submit"
          className="w-full py-2.5 rounded-full bg-rosa-800 hover:bg-rosa-900 text-white font-bold text-sm shadow transition"
        >
          Gerar Orientação de Triagem e Enviar ao Chat
        </button>
      </form>

      {assessment && (
        <div
          id="triagemResultadoBox"
          role="status"
          className={`p-4 rounded-2xl border text-xs space-y-1.5 ${RESULT_TONE[assessment.level]}`}
        >
          <div className="font-extrabold text-sm">Resultado da Triagem (RF10): {assessment.label}</div>
          <div>{assessment.guidance}</div>
        </div>
      )}
    </div>
  );
}
