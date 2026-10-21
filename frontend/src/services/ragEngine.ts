import type { AssistantReply, EmotionalClinicalContext } from '../types/chat';

const FEAR_WORDS = [
  'medo', 'assustada', 'apavorada', 'pavor', 'morrer', 'morte', 'pior', 'angústia', 'angustia',
  'ansiosa', 'ansiedade', 'chorando', 'triste', 'desesperada', 'pânico',
];
const SYMPTOM_WORDS = [
  'caroço', 'caroco', 'nódulo', 'nodulo', 'bolinha', 'dor', 'secreção', 'mamilo', 'vermelhidão', 'inchaço',
];
const EXAM_WORDS = [
  'bi-rads', 'birads', 'laudo', 'mamografia', 'ultrassom', 'ecografia', 'microcalcificações', 'cisto',
];

/** Detecta medo/ansiedade, sintomas físicos e termos de exame no texto da usuária. */
export function detectEmotionalAndClinicalContext(text: string): EmotionalClinicalContext {
  const lower = text.toLowerCase();
  return {
    hasFear: FEAR_WORDS.some((word) => lower.includes(word)),
    hasSymptom: SYMPTOM_WORDS.some((word) => lower.includes(word)),
    hasExam: EXAM_WORDS.some((word) => lower.includes(word)),
  };
}

/**
 * Motor clínico-empático RAG local da Doutora Rosa (100% offline).
 * Base: INCA, Ministério da Saúde e artigos do Projeto RosaIA / UNICEPLAC.
 */
export function generateLocalDoutoraRosaResponse(userText: string): AssistantReply {
  const ctx = detectEmotionalAndClinicalContext(userText);

  if (ctx.hasFear && ctx.hasSymptom) {
    return {
      emotionTag: 'Acolhimento Psicológico • Esperança e Tratamento',
      monitorUpdate: {
        badgeLabel: 'Apoio Psicológico Intensivo (Medo/Sintoma)',
        tone: 'attention',
        explanation: 'fear_symptom',
      },
      text: 'Respire fundo comigo por um instante. 💛 Eu compreendo perfeitamente o seu susto, mas quero te trazer uma informação científica muito importante para acalmar o seu coração:\n\n1. **Não é o pior dos casos:** Cerca de **80% dos caroços ou nódulos mamários palpáveis são alterações benignas** (como cistos simples ou fibroadenomas), que não são câncer.\n2. **Existe tratamento e cura:** Mesmo nos casos em que um diagnóstico oncológico se confirma, a medicina evoluiu imensamente. Segundo o **INCA e o Ministério da Saúde**, quando identificado precocemente, o câncer de mama tem **taxas de cura superiores a 95%**.\n3. **Próximo passo seguro:** Agende uma consulta com seu médico(a) mastologista ou ginecologista na UBS ou clínica para avaliar com calma. Você não está sozinha, tudo vai ficar bem e eu estou aqui para te apoiar!\n\n*(Nota: Minha orientação é educativa e de acolhimento, não substituindo a avaliação presencial do médico).* ',
    };
  }

  if (ctx.hasFear) {
    return {
      emotionTag: 'Apoio Psicológico • Saúde Emocional',
      monitorUpdate: { badgeLabel: 'Acolhimento Emocional (Ansiedade/Medo)', tone: 'support' },
      text: 'Eu acolho o que você está sentindo com todo carinho. 🌸 Sentir medo ou ansiedade diante de exames ou dúvidas sobre as mamas é uma reação humana muito comum — nossos estudos no **Projeto RosaIA (UNICEPLAC)** mostram que o acolhimento emocional é o primeiro passo do cuidado.\n\nLembre-se: cuidar da saúde não é procurar problemas, é garantir tranquilidade e qualidade de vida. Hoje contamos com tratamentos altamente eficazes, personalizados e acolhedores. Que tal fazermos uma pausa para respirar devagar? Se quiser, me conte um pouco mais sobre o que está passando pela sua cabeça.',
    };
  }

  if (ctx.hasSymptom) {
    return {
      emotionTag: 'Orientação em Saúde Mamária • INCA',
      monitorUpdate: { badgeLabel: 'Orientação de Sinais e Sintomas', tone: 'info' },
      text: 'Obrigada por compartilhar isso comigo! 🩺 Observar o próprio corpo é fundamental.\n\n• **O que saber sem alarme:** Dores mamárias, pequenos nódulos móveis ou alterações hormonais costumam ser frequentes e, na maioria das vezes, benignos.\n• **Quando procurar o médico:** Sempre que notar um caroço fixo, vermelhidão na pele (aspecto casca de laranja), retração ou saída espontânea de líquido pelo mamilo, o ideal é agendar uma consulta médica para avaliação clínica.\n\nQuer que eu crie um lembrete na aba **"Triagem & Lembretes"** para você agendar sua consulta?',
    };
  }

  if (ctx.hasExam) {
    return {
      emotionTag: 'Educação Radiológica • BI-RADS',
      text: 'Posso te ajudar a entender os termos do seu exame de forma bem simples! 📄\n\nNa radiologia mamária, os médicos usam a escala **BI-RADS** (de 0 a 6):\n• **BI-RADS 1 e 2:** Exame negativo ou com achado benigno (rotina normal!).\n• **BI-RADS 3:** Achado provavelmente benigno (mais de 98% de chance de benignidade, pede apenas acompanhamento em 6 meses).\n• **BI-RADS 4 e 5:** Pede uma avaliação complementar com o médico para esclarecer o achado.\n\nVocê pode anexar o arquivo **.PDF ou .TXT** do seu laudo no botão de clipe ao lado (lembrando que fotos/imagens são bloqueadas pela LGPD).',
    };
  }

  return {
    emotionTag: 'Orientação & Acolhimento • RosaIA',
    text: 'Estou aqui com você! 🌸 Como assistente virtual do **RosaIA APP**, posso conversar sobre prevenção, autoexame e sinais de alerta, oferecer apoio emocional para momentos de ansiedade ou traduzir os termos técnicos do seu laudo em PDF/texto. Como posso te ajudar agora?',
  };
}
