import type {
  AgeRange,
  FamilyHistory,
  HormonesStatus,
  MedicalFollowupStatus,
  MenopauseStatus,
  PregnancyStatus,
  RadiotherapyStatus,
  RiskLevel,
  SymptomDuration,
  SymptomSide,
  TriageAssessment,
  TriageInput,
  TriageSymptomOption,
} from '../types/triage';

export const AGE_RANGE_OPTIONS: ReadonlyArray<{ value: AgeRange; label: string }> = [
  { value: 'menos_40', label: 'Menos de 40 anos' },
  { value: '40_49', label: 'Entre 40 e 49 anos' },
  { value: '50_69', label: 'Entre 50 e 69 anos (Faixa prioritária de rastreamento do INCA)' },
  { value: '70_mais', label: '70 anos ou mais' },
  { value: 'prefiro_nao_informar', label: 'Prefiro não informar' },
];

export const FAMILY_HISTORY_OPTIONS: ReadonlyArray<{ value: FamilyHistory; label: string }> = [
  { value: 'nao', label: 'Não' },
  { value: 'sim', label: 'Sim (Mãe, irmã ou filha)' },
  { value: 'prefiro_nao_informar', label: 'Prefiro não informar' },
];

export const SYMPTOM_OPTIONS: ReadonlyArray<TriageSymptomOption> = [
  { value: 'Nenhum sintoma', label: 'Nenhum sintoma' },
  { value: 'Caroço ou nódulo na mama', label: 'Caroço ou nódulo na mama' },
  { value: 'Mudança no tamanho ou formato da mama', label: 'Mudança no tamanho ou formato da mama' },
  { value: 'Nódulo na axila', label: 'Nódulo na axila' },
  { value: 'Pele com aspecto de casca de laranja', label: 'Pele com aspecto de casca de laranja' },
  { value: 'Ferida ou descamação no mamilo', label: 'Ferida ou descamação no mamilo' },
  { value: 'Dor ou sensibilidade mamária', label: 'Dor ou sensibilidade mamária' },
  { value: 'Secreção espontânea no mamilo', label: 'Secreção espontânea no mamilo' },
];

export const SYMPTOM_SIDE_OPTIONS: ReadonlyArray<{ value: SymptomSide; label: string }> = [
  { value: 'Direita', label: 'Mama Direita' },
  { value: 'Esquerda', label: 'Mama Esquerda' },
  { value: 'Ambas', label: 'Ambas as mamas' },
  { value: 'Prefiro não informar', label: 'Prefiro não informar' },
];

export const SYMPTOM_DURATION_OPTIONS: ReadonlyArray<{ value: SymptomDuration; label: string }> = [
  { value: 'Menos de 1 semana', label: 'Menos de 1 semana' },
  { value: '1 a 4 semanas', label: '1 a 4 semanas' },
  { value: 'Mais de 1 mês', label: 'Mais de 1 mês' },
  { value: 'Prefiro não informar', label: 'Prefiro não informar' },
];

export const PREGNANCY_OPTIONS: ReadonlyArray<{ value: PregnancyStatus; label: string }> = [
  { value: 'Sim', label: 'Sim' },
  { value: 'Não', label: 'Não' },
  { value: 'Prefiro não informar', label: 'Prefiro não informar' },
];

export const HORMONES_OPTIONS: ReadonlyArray<{ value: HormonesStatus; label: string }> = [
  { value: 'Sim', label: 'Sim' },
  { value: 'Não', label: 'Não' },
  { value: 'Já usei', label: 'Já usei' },
  { value: 'Prefiro não informar', label: 'Prefiro não informar' },
];

export const MENOPAUSE_OPTIONS: ReadonlyArray<{ value: MenopauseStatus; label: string }> = [
  { value: 'Sim', label: 'Sim' },
  { value: 'Não', label: 'Não' },
  { value: 'Não sei', label: 'Não sei' },
  { value: 'Prefiro não informar', label: 'Prefiro não informar' },
];

export const RADIOTHERAPY_OPTIONS: ReadonlyArray<{ value: RadiotherapyStatus; label: string }> = [
  { value: 'Sim', label: 'Sim' },
  { value: 'Não', label: 'Não' },
  { value: 'Prefiro não informar', label: 'Prefiro não informar' },
];

export const MEDICAL_FOLLOWUP_OPTIONS: ReadonlyArray<{ value: MedicalFollowupStatus; label: string }> = [
  { value: 'Sim', label: 'Sim' },
  { value: 'Não', label: 'Não' },
  { value: 'Prefiro não informar', label: 'Prefiro não informar' },
];

/** Remove rigorosamente asteriscos e hashtags de qualquer texto da Doutora Rosa. */
export function cleanRosaFormatting(text: string): string {
  if (!text) return '';
  return text
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/#+/g, '')
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/\*/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Estratifica o risco de atenção de forma acolhedora, humana e sincera,
 * sem termos vagos ou ríspidos e sem caracteres markdown (* ou #).
 */
export function classifyTriage(input: TriageInput): TriageAssessment {
  const realSymptoms = input.symptoms.filter((s) => s.toLowerCase() !== 'nenhum sintoma');
  const hasSymptoms = realSymptoms.length > 0;
  const hasFamilyHistory = input.familyHistory === 'sim';

  let level: RiskLevel = 'rotina_preventiva';
  let label = 'Rotina Preventiva';

  if (hasSymptoms) {
    level = 'avaliacao_prioritaria';
    label = 'Avaliação Médica Prioritária com Acolhimento';
  } else if (hasFamilyHistory) {
    level = 'atencao_moderada';
    label = 'Atenção e Cuidado Preventivo Individualizado';
  }

  const guidance = generateTriageDoctorResponse(input);

  return {
    level,
    label,
    guidance,
  };
}

/**
 * Gera a resposta personalizada, empática, acolhedora e concisa da Doutora Rosa
 * baseada exclusivamente nos dados recém-enviados da triagem.
 * Elimina expressões confusas como "ver esse resultado" e inclui perguntas
 * gentis de acompanhamento clínico.
 */
export function generateTriageDoctorResponse(input: TriageInput): string {
  const parts: string[] = [];
  const realSymptoms = input.symptoms.filter((s) => s.toLowerCase() !== 'nenhum sintoma');
  const hasSymptoms = realSymptoms.length > 0;

  // Abertura afetuosa e empática
  parts.push(
    'Olá, querida! Recebi com todo o meu carinho as informações da sua triagem de atenção mamária. ' +
      'Estou aqui ao seu lado para conversarmos com calma, sinceridade e muita tranquilidade sobre cada ponto que você informou.',
  );

  // Análise da Faixa Etária
  if (input.ageRange === 'menos_40') {
    parts.push(
      'Sobre a sua faixa etária (menos de 40 anos): o tecido mamário costuma ser naturalmente mais denso e é muito comum surgirem pequenas oscilações, dores passageiras ou nódulos benignos (como cistos e fibroadenomas), geralmente associados aos hormônios.',
    );
  } else if (input.ageRange === '40_49') {
    parts.push(
      'Sobre a sua faixa etária (entre 40 e 49 anos): nesta fase, o autocuidado e as consultas clínicas anuais com seu mastologista ou ginecologista são fundamentais para manter seus exames de rastreamento em dia.',
    );
  } else if (input.ageRange === '50_69') {
    parts.push(
      'Sobre a sua faixa etária (entre 50 e 69 anos): você está na faixa em que o INCA e o Ministério da Saúde priorizam o rastreamento mamográfico a cada dois anos. Realizar a mamografia de rotina com serenidade é o seu maior gesto de proteção.',
    );
  } else if (input.ageRange === '70_mais') {
    parts.push(
      'Sobre a sua faixa etária (70 anos ou mais): o acompanhamento preventivo regular com seu médico assistente permite definir a periodicidade mais confortável e segura para o seu bem-estar.',
    );
  }

  // Análise dos Sintomas relatados
  if (hasSymptoms) {
    const symptomDetails: string[] = [];

    if (realSymptoms.some((s) => s.toLowerCase().includes('nódulo') || s.toLowerCase().includes('caroço'))) {
      symptomDetails.push(
        'Em relação ao caroço ou nódulo relatado: sei que notar qualquer bolinha na mama pode trazer preocupação imediata, mas quero que respire com serenidade. Cerca de 80% das alterações e nódulos nas mamas são completamente benignos (como cistos de água ou fibroadenomas). Uma consulta presencial com exame físico e exames de imagem trará todo o esclarecimento que você precisa.',
      );
    }

    if (realSymptoms.some((s) => s.toLowerCase().includes('axila'))) {
      symptomDetails.push(
        'Em relação ao nódulo na axila: muitas vezes trata-se de um gânglio reacional a uma depilação ou pequena inflamação benigna da pele, mas é prudente que o mastologista faça a palpação na sua consulta.',
      );
    }

    if (realSymptoms.some((s) => s.toLowerCase().includes('tamanho') || s.toLowerCase().includes('formato'))) {
      symptomDetails.push(
        'Em relação à mudança no formato ou tamanho da mama: é muito importante que o médico examine a simetria de perto para checar as causas comuns com toda a segurança.',
      );
    }

    if (realSymptoms.some((s) => s.toLowerCase().includes('casca de laranja') || s.toLowerCase().includes('pele'))) {
      symptomDetails.push(
        'Em relação ao aspecto na pele: o especialista irá examinar a textura mamária presencialmente para descartar inflamações normais do tecido dérmico.',
      );
    }

    if (realSymptoms.some((s) => s.toLowerCase().includes('ferida') || s.toLowerCase().includes('descamação') || s.toLowerCase().includes('mamilo'))) {
      symptomDetails.push(
        'Em relação à alteração ou descamação no mamilo: levar essa observação ao médico na UBS ou consultório é o passo certo para que ele examine as aréolas com delicadeza.',
      );
    }

    if (realSymptoms.some((s) => s.toLowerCase().includes('dor'))) {
      symptomDetails.push(
        'Em relação à dor na mama: a mastalgia é um dos sintomas mais frequentes no dia a dia da mulher e, na imensa maioria das vezes, está ligada a oscilações normais do ciclo hormonal.',
      );
    }

    if (realSymptoms.some((s) => s.toLowerCase().includes('secreção'))) {
      symptomDetails.push(
        'Em relação à secreção no mamilo: o mastologista verificará a coloração e o fluxo do líquido para orientar o cuidado com segurança.',
      );
    }

    // Informação de lado e tempo caso informado
    const complementos: string[] = [];
    if (input.symptomSide && input.symptomSide !== 'Prefiro não informar') {
      complementos.push(`Lado informado: ${input.symptomSide}`);
    }
    if (input.symptomDuration && input.symptomDuration !== 'Prefiro não informar') {
      complementos.push(`Tempo observado: ${input.symptomDuration}`);
    }
    if (complementos.length > 0) {
      symptomDetails.push(`Registrei suas observações complementares: ${complementos.join(' • ')}.`);
    }

    parts.push(symptomDetails.join('\n\n'));
  } else {
    parts.push(
      'É uma alegria saber que você não observou nódulos, dores ou sinais incomuns recentemente! Isso é um excelente indicativo. Parabéns por cuidar de si mesma e manter o olhar atento ao seu corpo.',
    );
  }

  // Análise do Histórico Familiar
  if (input.familyHistory === 'sim') {
    parts.push(
      'Sobre o histórico familiar de primeiro grau (mãe, irmã ou filha): acolho a história da sua família com muito respeito. Ter parentes que enfrentaram a doença não significa de forma alguma que você terá o mesmo caminho. Significa apenas que o seu médico planejará um cronograma preventivo mais precoce e personalizado para você, trazendo vigilância atenta e tranquilidade.',
    );
  } else if (input.familyHistory === 'nao') {
    parts.push(
      'O fato de não ter histórico de primeiro grau na família é um ponto muito favorável no seu perfil de saúde geral.',
    );
  }

  // Contexto Clínico Adicional (se informado)
  const contextoClinico: string[] = [];
  if (input.pregnancyBreastfeeding === 'Sim') {
    contextoClinico.push('Você informou estar grávida ou amamentando; nessa fase as mamas passam por intensas alterações glandulares benignas.');
  }
  if (input.hormonesMeds === 'Sim' || input.hormonesMeds === 'Já usei') {
    contextoClinico.push('O uso de hormônios ou medicamentos contínuos é sempre levado em conta pelo ginecologista para modular o tecido mamário.');
  }
  if (input.radiotherapy === 'Sim') {
    contextoClinico.push('O histórico de radioterapia torácica é um dado relevante que seu mastologista utilizará para personalizar o rastreamento.');
  }
  if (input.medicalFollowup === 'Sim') {
    contextoClinico.push('Excelente iniciativa manter seu acompanhamento regular com mastologista ou ginecologista.');
  }
  if (contextoClinico.length > 0) {
    parts.push(contextoClinico.join(' '));
  }

  // Perguntas de Acompanhamento Gentis e Conclusão Acolhedora
  if (hasSymptoms) {
    parts.push(
      'Lembre-se sempre: quando cuidamos da nossa saúde precocemente, as chances de cura superam 95%. Você não está sozinha e estou aqui com você.\n\n' +
        'Para que eu possa te acolher ainda melhor: quer me contar se você notou dor, se percebeu algum crescimento recente ou se há secreção? Como você está se sentindo neste momento?',
    );
  } else {
    parts.push(
      'Lembre-se sempre de que o autocuidado e os exames de rotina em dia são nossos maiores aliados de saúde.\n\n' +
        'Como você está se sentindo? Quer me contar mais sobre o que você notou ou tirar alguma dúvida comigo?',
    );
  }

  const fullText = parts.join('\n\n');
  return cleanRosaFormatting(fullText);
}

