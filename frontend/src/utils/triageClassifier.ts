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

/** Remove rigorosamente asteriscos e hashtags de qualquer texto da Doutora Rosa. */
export function cleanRosaFormatting(text: string): string {
  if (!text) return '';
  return text
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/#+/g, '')
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/\*/g, '')
    .trim();
}

/**
 * Estratifica o risco de atenção de forma acolhedora, humana e sincera,
 * sem termos vagos ou frios e sem caracteres markdown (* ou #).
 */
export function classifyTriage(input: TriageInput): TriageAssessment {
  const hasSymptoms = input.symptoms.length > 0;
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
 * Gera a resposta personalizada, empática, acolhedora e altamente específica
 * da Doutora Rosa baseada exclusivamente nas informações da triagem.
 */
export function generateTriageDoctorResponse(input: TriageInput): string {
  const parts: string[] = [];

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
  } else {
    parts.push(
      'Sobre a sua faixa etária (70 anos ou mais): o acompanhamento preventivo regular com seu médico assistente permite definir a periodicidade mais confortável e segura para o seu bem-estar.',
    );
  }

  // Análise dos Sintomas relatados
  if (input.symptoms.length > 0) {
    const symptomDetails: string[] = [];

    if (input.symptoms.some((s) => s.toLowerCase().includes('caroço') || s.toLowerCase().includes('nódulo'))) {
      symptomDetails.push(
        'Em relação ao nódulo ou caroço relatado: sei que notar qualquer bolinha na mama pode causar um susto imediato, mas quero que respire bem fundo. A ciência comprova que cerca de 80% dos nódulos mamários são alterações benignas (como cistos de água ou fibroadenomas). Uma consulta presencial com exame físico e, se necessário, uma ultrassonografia ou mamografia trarão a clareza e o alívio que você merece.',
      );
    }

    if (input.symptoms.some((s) => s.toLowerCase().includes('dor'))) {
      symptomDetails.push(
        'Em relação à dor mamária: a dor na mama (mastalgia) é um dos motivos mais frequentes de consulta e, na imensa maioria dos casos, não tem relação com doenças graves, sendo provocada por variações hormonais normais do ciclo.',
      );
    }

    if (input.symptoms.some((s) => s.toLowerCase().includes('vermelhidão') || s.toLowerCase().includes('pele'))) {
      symptomDetails.push(
        'Em relação à alteração ou vermelhidão na pele: é muito importante que o médico examine a textura da mama de perto para descartar inflamações normais da derme e indicar o cuidado certo.',
      );
    }

    if (input.symptoms.some((s) => s.toLowerCase().includes('secreção') || s.toLowerCase().includes('mamilo'))) {
      symptomDetails.push(
        'Em relação à alteração ou secreção no mamilo: levar essa observação ao médico na UBS ou clínica é o passo correto para que ele verifique as características desse líquido com carinho e precisão.',
      );
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
  } else {
    parts.push(
      'O fato de não ter histórico de primeiro grau na família é um ponto muito favorável no seu perfil de saúde geral.',
    );
  }

  // Conclusão Acolhedora e Empática
  parts.push(
    'Lembre-se sempre: quando cuidamos da nossa saúde precocemente, as chances de cura superam 95%. Você não está sozinha e estou aqui de mãos dadas com você.\n\n' +
      'Querida, como você está se sentindo agora ao ver esse resultado? Sinta-se totalmente à vontade para me fazer perguntas ou me contar qualquer sentimento que esteja em seu coração.',
  );

  const fullText = parts.join('\n\n');
  return cleanRosaFormatting(fullText);
}
