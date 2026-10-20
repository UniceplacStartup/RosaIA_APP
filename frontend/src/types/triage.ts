export type AgeRange = 'menos_40' | '40_49' | '50_69' | '70_mais';

export type FamilyHistory = 'nao' | 'sim';

export type RiskLevel = 'rotina_preventiva' | 'atencao_moderada' | 'avaliacao_prioritaria';

export interface TriageInput {
  ageRange: AgeRange;
  familyHistory: FamilyHistory;
  symptoms: string[];
}

export interface TriageAssessment {
  level: RiskLevel;
  /** Rótulo exibido ao usuário */
  label: string;
  guidance: string;
}

export interface TriageSymptomOption {
  value: string;
  label: string;
}
