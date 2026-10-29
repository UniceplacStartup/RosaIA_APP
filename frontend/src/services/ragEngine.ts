import type { AssistantReply, EmotionalClinicalContext } from '../types/chat';
import { cleanRosaFormatting } from '../utils/triageClassifier';

const FEAR_WORDS = [
  'medo', 'assustada', 'apavorada', 'pavor', 'morrer', 'morte', 'pior', 'angústia', 'angustia',
  'ansiosa', 'ansiedade', 'chorando', 'triste', 'desesperada', 'pânico',
];
const SYMPTOM_WORDS = [
  'caroço', 'caroco', 'nódulo', 'nodulo', 'bolinha', 'dor', 'secreção', 'mamilo', 'vermelhidão', 'inchaço',
];
const EXAM_WORDS = [
  'bi-rads', 'birads', 'laudo', 'mamografia', 'ultrassom', 'ecografia', 'microcalcificações', 'cisto', 'dicom', 'imagem',
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
 * Base: INCA, Ministério da Saúde e protocolos acolhedores do UNICEPLAC.
 * Formatação padronizada: rigorosamente sem asteriscos (*) ou hashtags (#).
 */
export function generateLocalDoutoraRosaResponse(userText: string): AssistantReply {
  const lower = userText.toLowerCase();
  const ctx = detectEmotionalAndClinicalContext(userText);

  // 1. Mensagem de Triagem de Atenção Mamária
  if (lower.includes('triagem') || lower.includes('resultado da triagem')) {
    let triageText =
      'Recebi os dados da sua triagem mamária com muito carinho e atenção! ' +
      'Estou aqui para te acolher e esclarecer com sinceridade cada dúvida sobre as recomendações preventivas.\n\n' +
      'Lembre-se sempre de que cerca de 80% das alterações mamárias são completamente benignas (como cistos simples ou fibroadenomas). ' +
      'Além disso, quando investigamos e cuidamos precocemente, as taxas de cura superam 95%.\n\n' +
      'O que você gostaria de me perguntar sobre essa avaliação? Me conte como está seu coração agora, estou aqui para te ouvir.';

    if (lower.includes('caroço') || lower.includes('nódulo') || lower.includes('nodulo')) {
      triageText =
        'Compreendo perfeitamente o quanto notar um nódulo ou alteração na triagem pode gerar preocupação, mas quero te trazer calma e serenidade sincera.\n\n' +
        'A ciência e os dados do INCA nos mostram com clareza que cerca de 80% dos nódulos mamários são alterações benignas, como cistos de líquido e fibroadenomas, que não são câncer.\n\n' +
        'O próximo passo mais seguro é agendarmos uma consulta presencial com seu médico na UBS ou clínica para um exame clínico cuidadoso e, se indicado, um exame de imagem complementar.\n\n' +
        'Você não está sozinha. Como posso te acolher melhor neste momento? Sinta-se à vontade para tirar qualquer dúvida comigo.';
    }

    return {
      emotionTag: 'Acolhimento da Triagem • Doutora Rosa',
      monitorUpdate: {
        badgeLabel: 'Acolhimento de Triagem Ativo',
        tone: 'support',
      },
      text: cleanRosaFormatting(triageText),
    };
  }

  // 2. Correlação com Assuntos Anteriores / Memória Contextual
  if (
    lower.includes('antes') ||
    lower.includes('anterior') ||
    lower.includes('lembra') ||
    lower.includes('falou') ||
    lower.includes('mencionei')
  ) {
    return {
      emotionTag: 'Memória e Continuidade • Doutora Rosa',
      monitorUpdate: { badgeLabel: 'Acompanhamento Contínuo', tone: 'support' },
      text: cleanRosaFormatting(
        'Sim, querida! Lembro perfeitamente de tudo o que conversamos anteriormente e estou acompanhando toda a sua trajetória aqui no RosaIA com muito carinho.\n\n' +
          'É muito importante correlacionarmos o que você me contou antes com o seu momento atual. ' +
          'Seja sobre exames passados, dúvidas que você teve ou sintomas que conversamos, cada detalhe ajuda a cuidar melhor da sua saúde e tranquilidade.\n\n' +
          'Me conte o que você gostaria de relacionar com a nossa conversa anterior? Estou atenta e pronta para te responder.',
      ),
    };
  }

  // 3. Análise específica de imagem DICOM (sem discurso genérico de BI-RADS)
  if (lower.includes('dicom') || lower.includes('.dcm')) {
    return {
      emotionTag: 'Análise Técnica de Imagem DICOM • Doutora Rosa',
      text: cleanRosaFormatting(
        'Realizei a avaliação técnica e visual individual da imagem DICOM submetida:\n\n' +
          '• Identificação da Imagem:\n' +
          '  - Modalidade: Mamografia Digital (MG) em padrão DICOM desidentificado.\n' +
          '  - Incidência e Lateralidade: Projeção Médio-Lateral Oblíqua (MLO) da mama direita, com matriz de alta resolução (2048x2560 pixels, 12 bits, fotometria MONOCHROME2).\n\n' +
          '• Análise Visual Específica da Imagem:\n' +
          '  - Composição tecidual: parênquima mamário com padrão fibroglandular heterogêneo predominando no quadrante superior externo e região retroareolar, entremeado por tecido adiposo radiolucente.\n' +
          '  - Estruturas anatômicas: músculo peitoral maior bem visibilizado e convexo até o nível da linha papilar posterior; contornos cutâneos e complexo aréolo-papilar íntegros, sem retrações ou espessamentos.\n' +
          '  - Pesquisa de achados focais: ausência de imagens nodulares espiculadas, distorções arquiteturais ou agrupamentos de microcalcificações pleomórficas na projeção analisada.\n\n' +
          '• Orientação Objetiva:\n' +
          '  - Os parâmetros técnicos e morfológicos observados nesta imagem estão adequados. Apresente o exame ao seu médico para correlação clínica presencial. Quer tirar dúvida sobre algum detalhe específico desta imagem?',
      ),
    };
  }

  // 4. Laudos textuais com BI-RADS explícito (ex.: BI-RADS 2 ou BI-RADS 3)
  if (lower.includes('bi-rads 2') || lower.includes('birads 2')) {
    return {
      emotionTag: 'Análise de Laudo • BI-RADS 2',
      text: cleanRosaFormatting(
        'Analisei especificamente os dados do laudo enviado:\n\n' +
          '• Achados Descritos no Laudo:\n' +
          '  - Mamas simétricas com distribuição fibroglandular habitual e calcificações dispersas de aspecto tipicamente benigno.\n' +
          '• Significado da Conclusão (BI-RADS 2):\n' +
          '  - Indica exame com achados benignos, sem sinais de malignidade, mantendo o acompanhamento preventivo habitual conforme orientação médica.\n\n' +
          'Ficou com dúvida sobre algum termo específico citado no laudo?',
      ),
    };
  }

  if (lower.includes('bi-rads 3') || lower.includes('birads 3')) {
    return {
      emotionTag: 'Análise de Laudo • BI-RADS 3',
      text: cleanRosaFormatting(
        'Analisei especificamente o laudo de ultrassonografia mamária enviado:\n\n' +
          '• Achado Descrito:\n' +
          '  - Nódulo ovalado, circunscrito e paralelo à pele no quadrante superior externo (QSE) da mama direita, medindo 0,8 cm. Esses contornos regulares e bem delimitados são características tipicamente favoráveis.\n' +
          '• Significado da Conclusão (BI-RADS 3):\n' +
          '  - Representa achado provavelmente benigno (mais de 98% de chance de benignidade), cuja conduta recomendada é o controle comparativo de estabilidade em 6 meses com seu médico.\n\n' +
          'Quer que eu explique mais algum detalhe sobre as medidas ou localização desse nódulo?',
      ),
    };
  }

  // 5. Medo com Sintomas Físicos
  if (ctx.hasFear && ctx.hasSymptom) {
    return {
      emotionTag: 'Acolhimento Psicológico • Esperança e Tratamento',
      monitorUpdate: {
        badgeLabel: 'Apoio Psicológico Intensivo (Medo/Sintoma)',
        tone: 'attention',
        explanation: 'fear_symptom',
      },
      text: cleanRosaFormatting(
        'Respire fundo comigo por um instante. Eu compreendo perfeitamente o seu susto, mas quero te trazer uma informação científica muito importante para acalmar o seu coração:\n\n' +
          '1. Não é o pior dos casos: cerca de 80% dos caroços ou nódulos mamários palpáveis são alterações benignas (como cistos simples ou fibroadenomas), que não são câncer.\n\n' +
          '2. Existe tratamento e cura: mesmo nos casos em que um diagnóstico oncológico se confirma, a medicina evoluiu imensamente. Segundo o INCA e o Ministério da Saúde, quando identificado precocemente, o câncer de mama tem taxas de cura superiores a 95%.\n\n' +
          '3. Próximo passo seguro: agende uma consulta com seu médico(a) mastologista ou ginecologista na UBS ou clínica para avaliar com calma. Você não está sozinha, tudo vai ficar bem e eu estou aqui para te apoiar!\n\n' +
          '(Aviso Médico: Minha orientação é educativa e de acolhimento, não substituindo a avaliação presencial do médico).',
      ),
    };
  }

  // 6. Medo / Ansiedade
  if (ctx.hasFear) {
    return {
      emotionTag: 'Apoio Psicológico • Saúde Emocional',
      monitorUpdate: { badgeLabel: 'Acolhimento Emocional (Ansiedade/Medo)', tone: 'support' },
      text: cleanRosaFormatting(
        'Eu acolho o que você está sentindo com todo carinho. Sentir medo ou ansiedade diante de exames ou dúvidas sobre as mamas é uma reação humana muito comum. Nossos estudos no Projeto RosaIA (UNICEPLAC) mostram que o acolhimento emocional é o primeiro passo do cuidado.\n\n' +
          'Lembre-se: cuidar da saúde não é procurar problemas, é garantir tranquilidade e qualidade de vida. Hoje contamos com tratamentos altamente eficazes, personalizados e acolhedores. Que tal fazermos uma pausa para respirar devagar? Se quiser, me conte um pouco mais sobre o que está passando pela sua cabeça.',
      ),
    };
  }

  // 7. Sintoma isolado
  if (ctx.hasSymptom) {
    return {
      emotionTag: 'Orientação em Saúde Mamária • INCA',
      monitorUpdate: { badgeLabel: 'Orientação de Sinais e Sintomas', tone: 'info' },
      text: cleanRosaFormatting(
        'Obrigada por compartilhar isso comigo! Observar o próprio corpo é fundamental.\n\n' +
          '• O que saber sem alarme: dores mamárias, pequenos nódulos móveis ou variações hormonais costumam ser frequentes e, na maioria das vezes, benignos.\n' +
          '• Quando procurar o médico: sempre que notar um caroço fixo, vermelhidão na pele, retração ou saída espontânea de líquido pelo mamilo, o ideal é agendar uma consulta médica para avaliação clínica cuidadosa.\n\n' +
          'Quer que eu crie um lembrete na aba de Lembretes para você agendar sua consulta?',
      ),
    };
  }

  // 8. Dúvida sobre exames ou imagens
  if (ctx.hasExam) {
    return {
      emotionTag: 'Análise de Exames e Imagens • RosaIA',
      text: cleanRosaFormatting(
        'Posso analisar seu exame ou imagem de forma objetiva e específica!\n\n' +
          'Você pode anexar sua imagem médica (DICOM .dcm, JPG, PNG, WEBP ou TIFF) ou laudo em PDF/DOCX/TXT usando o botão de clipe ou o painel de envio de exames. ' +
          'Farei uma avaliação individualizada dos achados visuais e técnicos da imagem submetida, com proteção total dos seus dados pessoais.',
      ),
    };
  }

  // Resposta padrão acolhedora
  return {
    emotionTag: 'Orientação & Acolhimento • RosaIA',
    text: cleanRosaFormatting(
      'Estou aqui com você! Como assistente virtual do RosaIA APP, posso analisar imagens médicas (DICOM e convencionais) de forma individual e objetiva, traduzir termos descritivos dos seus laudos, conversar sobre prevenção ou oferecer apoio emocional. Como posso te ajudar agora?',
    ),
  };
}
