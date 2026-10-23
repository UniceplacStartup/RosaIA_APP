import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useToast } from '../../context/ToastContext';
import { useUi } from '../../context/UiContext';
import type {
  AgeRange,
  AlcoholFrequency,
  FamilyHistory,
  HormonesStatus,
  MedicalFollowupStatus,
  MenopauseStatus,
  PhysicalActivityFrequency,
  PregnancyStatus,
  RadiotherapyStatus,
  RiskLevel,
  SmokingFrequency,
  SymptomDuration,
  SymptomSide,
  TriageAssessment,
  TriageInput,
} from '../../types/triage';
import {
  AGE_RANGE_OPTIONS,
  classifyTriage,
  FAMILY_HISTORY_OPTIONS,
  HORMONES_OPTIONS,
  MEDICAL_FOLLOWUP_OPTIONS,
  MENOPAUSE_OPTIONS,
  PREGNANCY_OPTIONS,
  RADIOTHERAPY_OPTIONS,
  SYMPTOM_DURATION_OPTIONS,
  SYMPTOM_OPTIONS,
  SYMPTOM_SIDE_OPTIONS,
} from '../../utils/triageClassifier';
import { getUserStorageKey, safeGetStorage, safeRemoveStorage, safeSetStorage, STORAGE_KEYS } from '../../utils/storage';

const RESULT_TONE: Record<RiskLevel, string> = {
  rotina_preventiva: 'bg-emerald-50 border-emerald-300 text-emerald-900',
  atencao_moderada: 'bg-rosa-100 border-rosa-300 text-rosa-900',
  avaliacao_prioritaria: 'bg-amber-50 border-amber-300 text-amber-900',
};

interface StoredTriageState {
  ageRange: AgeRange | '';
  familyHistory: FamilyHistory | '';
  symptoms: string[];
  symptomSide: SymptomSide | '';
  symptomDuration: SymptomDuration | '';
  pregnancyBreastfeeding: PregnancyStatus | '';
  hormonesMeds: HormonesStatus | '';
  menopause: MenopauseStatus | '';
  radiotherapy: RadiotherapyStatus | '';
  smoking: SmokingFrequency | '';
  alcohol: AlcoholFrequency | '';
  physicalActivity: PhysicalActivityFrequency | '';
  medicalFollowup: MedicalFollowupStatus | '';
  assessment: TriageAssessment | null;
}

const DEFAULT_STATE: StoredTriageState = {
  ageRange: '',
  familyHistory: '',
  symptoms: [],
  symptomSide: '',
  symptomDuration: '',
  pregnancyBreastfeeding: '',
  hormonesMeds: '',
  menopause: '',
  radiotherapy: '',
  smoking: '',
  alcohol: '',
  physicalActivity: '',
  medicalFollowup: '',
  assessment: null,
};

/** Triagem Inteligente e Acolhedora de Atenção Mamária (RF10). */
export default function TriageSection() {
  const { user, accountResetToken } = useAuth();
  const { showToast } = useToast();
  const { submitTriageToChat } = useChat();
  const { setActiveTab } = useUi();

  const storageKey = getUserStorageKey(STORAGE_KEYS.triage, user?.email);

  const [state, setState] = useState<StoredTriageState>(() =>
    safeGetStorage<StoredTriageState>(storageKey, DEFAULT_STATE),
  );

  // Sincroniza e limpa estado caso mude a conta ou ocorra logout
  useEffect(() => {
    const loaded = safeGetStorage<StoredTriageState>(storageKey, DEFAULT_STATE);
    setState(loaded);
  }, [storageKey, accountResetToken]);

  // Salva respostas isoladas no storage da usuária
  const updateState = useCallback(
    (updater: (prev: StoredTriageState) => StoredTriageState) => {
      setState((prev) => {
        const next = updater(prev);
        safeSetStorage(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const handleClear = () => {
    safeRemoveStorage(storageKey);
    setState(DEFAULT_STATE);
    showToast(
      'Triagem Reiniciada',
      'As respostas anteriores foram limpas com sucesso. Você pode refazer a triagem a qualquer momento.',
      'info',
    );
  };

  const toggleSymptom = (value: string) => {
    updateState((prev) => {
      if (value === 'Nenhum sintoma') {
        const hasNone = prev.symptoms.includes('Nenhum sintoma');
        return {
          ...prev,
          symptoms: hasNone ? [] : ['Nenhum sintoma'],
        };
      }
      const withoutNone = prev.symptoms.filter((s) => s !== 'Nenhum sintoma');
      const nextSymptoms = withoutNone.includes(value)
        ? withoutNone.filter((s) => s !== value)
        : [...withoutNone, value];
      return {
        ...prev,
        symptoms: nextSymptoms,
      };
    });
  };

  const hasSpecificSymptoms = state.symptoms.some((s) => s !== 'Nenhum sintoma');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!state.ageRange) {
      showToast('Faixa Etária', 'Por favor, selecione sua faixa etária para prosseguir com a triagem.', 'warning');
      return;
    }

    if (state.symptoms.length === 0) {
      showToast('Sinais e Sintomas', 'Por favor, assinale as alterações observadas ou marque a opção "Nenhum sintoma".', 'warning');
      return;
    }

    const input: TriageInput = {
      ageRange: state.ageRange,
      familyHistory: (state.familyHistory || 'prefiro_nao_informar') as FamilyHistory,
      symptoms: state.symptoms,
      symptomSide: hasSpecificSymptoms ? ((state.symptomSide || 'Prefiro não informar') as SymptomSide) : undefined,
      symptomDuration: hasSpecificSymptoms ? ((state.symptomDuration || 'Prefiro não informar') as SymptomDuration) : undefined,
      pregnancyBreastfeeding: (state.pregnancyBreastfeeding || 'Prefiro não informar') as PregnancyStatus,
      hormonesMeds: (state.hormonesMeds || 'Prefiro não informar') as HormonesStatus,
      menopause: (state.menopause || 'Prefiro não informar') as MenopauseStatus,
      radiotherapy: (state.radiotherapy || 'Prefiro não informar') as RadiotherapyStatus,
      lifestyle: {
        smoking: (state.smoking || 'Prefiro não informar') as SmokingFrequency,
        alcohol: (state.alcohol || 'Prefiro não informar') as AlcoholFrequency,
        physicalActivity: (state.physicalActivity || 'Prefiro não informar') as PhysicalActivityFrequency,
      },
      medicalFollowup: (state.medicalFollowup || 'Prefiro não informar') as MedicalFollowupStatus,
    };

    const result = classifyTriage(input);
    updateState((prev) => ({ ...prev, assessment: result }));

    // 1. Gera e envia a mensagem e resposta acolhedora da triagem diretamente no chat
    submitTriageToChat(input);

    // 2. Transição automática imediata para o chat
    setActiveTab('chat');

    // 3. Notificação acolhedora
    showToast(
      'Triagem Concluída com Sucesso!',
      'Você foi conectada ao chat. A Doutora Rosa já preparou sua mensagem de acolhimento personalizada!',
      'success',
    );
  };

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 border border-rosa-200 shadow-sm space-y-5">
      {/* Cabeçalho da Seção de Triagem */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rosa-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-rosa-900">🩺 Triagem de Atenção Mamária</h2>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-rosa-100 text-rosa-800 font-bold">
              Educativo • Acolhimento Humanizado
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Responda às perguntas com tranquilidade. Suas respostas são confidenciais e ajudam a Doutora Rosa a
            preparar uma orientação personalizada e carinhosa para você.
          </p>
        </div>

        {/* Botão Nova Triagem / Limpar */}
        <button
          type="button"
          onClick={handleClear}
          id="btnNovaTriagemLimpar"
          className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl border border-rosa-300 bg-rosa-50 hover:bg-rosa-100 text-rosa-800 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          title="Limpar respostas e refazer triagem"
        >
          <span>🔄</span>
          <span>Nova Triagem / Limpar</span>
        </button>
      </div>

      <form id="formTriagem" className="space-y-4" onSubmit={handleSubmit}>
        {/* 1. Faixa Etária */}
        <div className="bg-rosa-50/50 p-3.5 rounded-xl border border-rosa-100">
          <label htmlFor="triagemIdade" className="block text-xs font-bold text-rosa-900 mb-1">
            1. Faixa Etária
          </label>
          <select
            id="triagemIdade"
            value={state.ageRange}
            onChange={(e) => updateState((prev) => ({ ...prev, ageRange: e.target.value as AgeRange }))}
            className="w-full px-3 py-2 rounded-xl border border-rosa-300 text-xs bg-white font-medium focus:ring-2 focus:ring-rosa-500 outline-none"
          >
            <option value="" disabled>
              Selecione sua faixa etária...
            </option>
            {AGE_RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Histórico Familiar */}
        <fieldset className="bg-rosa-50/50 p-3.5 rounded-xl border border-rosa-100">
          <legend className="block text-xs font-bold text-rosa-900 mb-1.5">
            2. Histórico Familiar de Câncer de Mama ou Ovário (Parentes de 1º Grau)
          </legend>
          <div className="flex flex-wrap gap-4 text-xs">
            {FAMILY_HISTORY_OPTIONS.map((opt) => (
              <label key={opt.value} className="inline-flex items-center gap-2 cursor-pointer font-medium text-gray-700">
                <input
                  type="radio"
                  name="triagemHist"
                  value={opt.value}
                  checked={state.familyHistory === opt.value}
                  onChange={() => updateState((prev) => ({ ...prev, familyHistory: opt.value }))}
                  className="accent-rosa-800 cursor-pointer"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* 3. Sintomas Observados */}
        <fieldset className="bg-rosa-50/50 p-3.5 rounded-xl border border-rosa-100">
          <legend className="block text-xs font-bold text-rosa-900 mb-1.5">
            3. Sinais ou Sintomas Observados Recentemente
          </legend>
          <p className="text-[11px] text-gray-500 mb-2">
            Selecione qualquer alteração que você tenha notado nas mamas ou axilas (ou marque "Nenhum sintoma"):
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {SYMPTOM_OPTIONS.map((option) => {
              const isChecked = state.symptoms.includes(option.value);
              return (
                <label
                  key={option.value}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition ${
                    isChecked
                      ? 'bg-rosa-100 border-rosa-400 font-semibold text-rosa-950 shadow-xs'
                      : 'bg-white border-rosa-200 hover:bg-rosa-50 text-gray-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    value={option.value}
                    checked={isChecked}
                    onChange={() => toggleSymptom(option.value)}
                    className="accent-rosa-800 cursor-pointer w-4 h-4 rounded"
                  />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>

          {/* Seletores complementares caso haja sintoma marcado */}
          {hasSpecificSymptoms && (
            <div className="mt-3.5 p-3 rounded-xl bg-white border border-rosa-300 space-y-3 animate-fade-in">
              <div className="text-xs font-bold text-rosa-900 flex items-center gap-1.5">
                <span>📍</span>
                <span>Detalhes Complementares dos Sintomas Relatados:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label htmlFor="selectSymptomSide" className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Lado Afetado:
                  </label>
                  <select
                    id="selectSymptomSide"
                    value={state.symptomSide}
                    onChange={(e) => updateState((prev) => ({ ...prev, symptomSide: e.target.value as SymptomSide }))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-rosa-300 text-xs bg-white"
                  >
                    <option value="" disabled>
                      Selecione o lado afetado...
                    </option>
                    {SYMPTOM_SIDE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="selectSymptomDuration" className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Há quanto tempo notou o sintoma?
                  </label>
                  <select
                    id="selectSymptomDuration"
                    value={state.symptomDuration}
                    onChange={(e) =>
                      updateState((prev) => ({ ...prev, symptomDuration: e.target.value as SymptomDuration }))
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-rosa-300 text-xs bg-white"
                  >
                    <option value="" disabled>
                      Selecione o tempo observado...
                    </option>
                    {SYMPTOM_DURATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </fieldset>

        {/* 4. Novas Perguntas Clínicas e de Contexto */}
        <div className="space-y-3 bg-rosa-50/40 p-3.5 rounded-xl border border-rosa-200">
          <div className="text-xs font-extrabold uppercase tracking-wider text-rosa-900">
            🏥 Contexto Clínico &amp; Saúde Geral
          </div>

          {/* 4.1 Gestação e amamentação */}
          <fieldset>
            <legend className="block text-xs font-bold text-gray-800 mb-1">
              4. Está grávida ou amamentando?
            </legend>
            <div className="flex flex-wrap gap-4 text-xs">
              {PREGNANCY_OPTIONS.map((opt) => (
                <label key={opt.value} className="inline-flex items-center gap-1.5 cursor-pointer text-gray-700">
                  <input
                    type="radio"
                    name="triagemGestacao"
                    value={opt.value}
                    checked={state.pregnancyBreastfeeding === opt.value}
                    onChange={() => updateState((prev) => ({ ...prev, pregnancyBreastfeeding: opt.value }))}
                    className="accent-rosa-800 cursor-pointer"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* 4.2 Hormônios e Medicamentos */}
          <fieldset className="pt-2 border-t border-rosa-100">
            <legend className="block text-xs font-bold text-gray-800 mb-1">
              5. Usa anticoncepcional, reposição hormonal ou medicamentos contínuos?
            </legend>
            <div className="flex flex-wrap gap-4 text-xs">
              {HORMONES_OPTIONS.map((opt) => (
                <label key={opt.value} className="inline-flex items-center gap-1.5 cursor-pointer text-gray-700">
                  <input
                    type="radio"
                    name="triagemHormonios"
                    value={opt.value}
                    checked={state.hormonesMeds === opt.value}
                    onChange={() => updateState((prev) => ({ ...prev, hormonesMeds: opt.value }))}
                    className="accent-rosa-800 cursor-pointer"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* 4.3 Menopausa */}
          <fieldset className="pt-2 border-t border-rosa-100">
            <legend className="block text-xs font-bold text-gray-800 mb-1">
              6. Já entrou na menopausa?
            </legend>
            <div className="flex flex-wrap gap-4 text-xs">
              {MENOPAUSE_OPTIONS.map((opt) => (
                <label key={opt.value} className="inline-flex items-center gap-1.5 cursor-pointer text-gray-700">
                  <input
                    type="radio"
                    name="triagemMenopausa"
                    value={opt.value}
                    checked={state.menopause === opt.value}
                    onChange={() => updateState((prev) => ({ ...prev, menopause: opt.value }))}
                    className="accent-rosa-800 cursor-pointer"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* 4.4 Radioterapia */}
          <fieldset className="pt-2 border-t border-rosa-100">
            <legend className="block text-xs font-bold text-gray-800 mb-1">
              7. Já realizou radioterapia na região do tórax anteriormente?
            </legend>
            <div className="flex flex-wrap gap-4 text-xs">
              {RADIOTHERAPY_OPTIONS.map((opt) => (
                <label key={opt.value} className="inline-flex items-center gap-1.5 cursor-pointer text-gray-700">
                  <input
                    type="radio"
                    name="triagemRadioterapia"
                    value={opt.value}
                    checked={state.radiotherapy === opt.value}
                    onChange={() => updateState((prev) => ({ ...prev, radiotherapy: opt.value }))}
                    className="accent-rosa-800 cursor-pointer"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* 4.5 Estilo de vida */}
          <div className="pt-2 border-t border-rosa-100 space-y-2">
            <span className="block text-xs font-bold text-gray-800">
              8. Estilo de vida e hábitos cotidianos:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div>
                <label htmlFor="selectSmoking" className="block text-[11px] text-gray-600 mb-1">
                  Tabagismo:
                </label>
                <select
                  id="selectSmoking"
                  value={state.smoking}
                  onChange={(e) => updateState((prev) => ({ ...prev, smoking: e.target.value as SmokingFrequency }))}
                  className="w-full px-2 py-1.5 rounded-lg border border-rosa-300 bg-white text-xs"
                >
                  <option value="" disabled>
                    Selecione...
                  </option>
                  <option value="Não fumo">Não fumo</option>
                  <option value="Ocasionalmente">Ocasionalmente</option>
                  <option value="Diariamente">Diariamente</option>
                  <option value="Ex-fumante">Ex-fumante</option>
                  <option value="Prefiro não informar">Prefiro não informar</option>
                </select>
              </div>

              <div>
                <label htmlFor="selectAlcohol" className="block text-[11px] text-gray-600 mb-1">
                  Consumo de Álcool:
                </label>
                <select
                  id="selectAlcohol"
                  value={state.alcohol}
                  onChange={(e) => updateState((prev) => ({ ...prev, alcohol: e.target.value as AlcoholFrequency }))}
                  className="w-full px-2 py-1.5 rounded-lg border border-rosa-300 bg-white text-xs"
                >
                  <option value="" disabled>
                    Selecione...
                  </option>
                  <option value="Não consumo">Não consumo</option>
                  <option value="Socialmente (finais de semana)">Socialmente</option>
                  <option value="Frequente">Frequente</option>
                  <option value="Prefiro não informar">Prefiro não informar</option>
                </select>
              </div>

              <div>
                <label htmlFor="selectActivity" className="block text-[11px] text-gray-600 mb-1">
                  Atividade Física:
                </label>
                <select
                  id="selectActivity"
                  value={state.physicalActivity}
                  onChange={(e) =>
                    updateState((prev) => ({ ...prev, physicalActivity: e.target.value as PhysicalActivityFrequency }))
                  }
                  className="w-full px-2 py-1.5 rounded-lg border border-rosa-300 bg-white text-xs"
                >
                  <option value="" disabled>
                    Selecione...
                  </option>
                  <option value="Sedentária">Sedentária</option>
                  <option value="1 a 2 vezes por semana">1 a 2 vezes/semana</option>
                  <option value="3 ou mais vezes por semana">3 ou mais vezes/semana</option>
                  <option value="Prefiro não informar">Prefiro não informar</option>
                </select>
              </div>
            </div>
          </div>

          {/* 4.6 Acompanhamento Médico Regular */}
          <fieldset className="pt-2 border-t border-rosa-100">
            <legend className="block text-xs font-bold text-gray-800 mb-1">
              9. Faz acompanhamento médico regular com mastologista ou ginecologista?
            </legend>
            <div className="flex flex-wrap gap-4 text-xs">
              {MEDICAL_FOLLOWUP_OPTIONS.map((opt) => (
                <label key={opt.value} className="inline-flex items-center gap-1.5 cursor-pointer text-gray-700">
                  <input
                    type="radio"
                    name="triagemFollowup"
                    value={opt.value}
                    checked={state.medicalFollowup === opt.value}
                    onChange={() => updateState((prev) => ({ ...prev, medicalFollowup: opt.value }))}
                    className="accent-rosa-800 cursor-pointer"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        {/* Botão de Envio e Transição Automática */}
        <div className="pt-2">
          <button
            type="submit"
            id="btnFinalizarTriagem"
            className="w-full py-3.5 px-4 rounded-full bg-rosa-800 hover:bg-rosa-900 active:scale-[0.99] text-white font-extrabold text-sm shadow-md transition flex items-center justify-center gap-2"
          >
            <span>💬 Gerar Orientação de Triagem e Ir para o Chat</span>
          </button>
        </div>
      </form>

      {/* Caixa de Resultado / Confirmação */}
      {state.assessment && (
        <div
          id="triagemResultadoBox"
          role="status"
          className={`p-4 rounded-2xl border text-xs space-y-2 animate-fade-in ${RESULT_TONE[state.assessment.level]}`}
        >
          <div className="font-extrabold text-sm flex items-center justify-between">
            <span>Classificação Educativa: {state.assessment.label}</span>
            <span className="text-[11px] font-normal underline cursor-pointer" onClick={() => setActiveTab('chat')}>
              Ver no Chat →
            </span>
          </div>
          <div className="whitespace-pre-line leading-relaxed">{state.assessment.guidance}</div>
        </div>
      )}
    </div>
  );
}

