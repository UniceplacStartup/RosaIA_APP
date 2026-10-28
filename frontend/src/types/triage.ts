export type GenderIdentity = 'mulher' | 'homem' | 'mulher_trans' | 'homem_trans';

export type AgeRange = 'menos_40' | '40_49' | '50_69' | '70_mais' | 'prefiro_nao_informar';

export type FamilyHistory = 'nao' | 'sim' | 'prefiro_nao_informar';

export type SymptomSide = 'Direita' | 'Esquerda' | 'Ambas' | 'Prefiro não informar';

export type SymptomDuration = 'Menos de 1 semana' | '1 a 4 semanas' | 'Mais de 1 mês' | 'Prefiro não informar';

export type PregnancyStatus = 'Sim' | 'Não' | 'Prefiro não informar';

export type HormonesStatus = 'Sim' | 'Não' | 'Já usei' | 'Prefiro não informar';

export type MenopauseStatus = 'Sim' | 'Não' | 'Não sei' | 'Prefiro não informar';

export type RadiotherapyStatus = 'Sim' | 'Não' | 'Prefiro não informar';

export type SmokingFrequency = 'Não fumo' | 'Ocasionalmente' | 'Diariamente' | 'Ex-fumante' | 'Prefiro não informar';

export type AlcoholFrequency = 'Não consumo' | 'Socialmente (finais de semana)' | 'Frequente' | 'Prefiro não informar';

export type PhysicalActivityFrequency = 'Sedentária' | '1 a 2 vezes por semana' | '3 ou mais vezes por semana' | 'Prefiro não informar';

export type MedicalFollowupStatus = 'Sim' | 'Não' | 'Prefiro não informar';

export type RiskLevel = 'rotina_preventiva' | 'atencao_moderada' | 'avaliacao_prioritaria';

export interface LifestyleData {
  smoking: SmokingFrequency;
  alcohol: AlcoholFrequency;
  physicalActivity: PhysicalActivityFrequency;
}

export interface TriageInput {
  gender: GenderIdentity;
  ageRange: AgeRange;
  familyHistory: FamilyHistory;
  symptoms: string[];
  symptomSide?: SymptomSide;
  symptomDuration?: SymptomDuration;
  pregnancyBreastfeeding?: PregnancyStatus;
  hormonesMeds?: HormonesStatus;
  menopause?: MenopauseStatus;
  radiotherapy?: RadiotherapyStatus;
  lifestyle?: LifestyleData;
  medicalFollowup?: MedicalFollowupStatus;
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

