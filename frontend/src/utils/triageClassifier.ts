import type { AgeRange, RiskLevel, TriageAssessment, TriageInput, TriageSymptomOption } from '../types/triage';

export const AGE_RANGE_OPTIONS: ReadonlyArray<{ value: AgeRange; label: string }> = [
  { value: 'menos_40', label: 'Menos de 40 anos' },
  { value: '40_49', label: 'Entre 40 e 49 anos' },
  { value: '50_69', label: 'Entre 50 e 69 anos (Faixa prioritária de rastreamento INCA)' },
  { value: '70_mais', label: '70 anos ou mais' },
];

export const SYMPTOM_OPTIONS: ReadonlyArray<TriageSymptomOption> = [
  { value: 'Caroço ou nódulo fixo', label: 'Caroço ou nódulo' },
  { value: 'Dor ou sensibilidade mamária', label: 'Dor na mama' },
  { value: 'Alteração na pele ou vermelhidão', label: 'Vermelhidão / pele retraída' },
  { value: 'Secreção espontânea no mamilo', label: 'Alteração ou secreção no mamilo' },
];

/**
 * Estratifica o risco de atenção (educativo, não diagnóstico):
 * - qualquer sintoma  → Avaliação Prioritária
 * - apenas histórico  → Atenção Moderada
 * - sem fatores       → Rotina Preventiva
 */
export function classifyTriage(input: TriageInput): TriageAssessment {
  const hasSymptoms = input.symptoms.length > 0;
  const hasFamilyHistory = input.familyHistory === 'sim';

  if (!hasSymptoms && !hasFamilyHistory) {
    return {
      level: 'rotina_preventiva',
      label: 'Rotina Preventiva',
      guidance:
        'Você não relatou sinais de alerta imediatos. Continue realizando seus exames preventivos conforme a faixa etária recomendada pelo Ministério da Saúde e INCA.',
    };
  }

  const level: RiskLevel = hasSymptoms ? 'avaliacao_prioritaria' : 'atencao_moderada';
  const label = hasSymptoms
    ? 'Avaliação Médica Prioritária (Sem Pânico)'
    : 'Atenção Moderada (Histórico Familiar)';
  const factors = input.symptoms.join(', ') || 'histórico familiar de 1º grau';

  return {
    level,
    label,
    guidance: `Identificamos fatores que merecem avaliação clínica presencial (${factors}). Lembre-se: a maioria das alterações é benigna e tem tratamento eficaz, mas agendar uma consulta com seu médico(a) garante cuidado precoce e tranquilidade.`,
  };
}
