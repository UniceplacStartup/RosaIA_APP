import type { SampleDocumentKind } from '../types/chat';

export interface SampleDocumentScenario {
  kind: SampleDocumentKind;
  toastTitle: string;
  toastMessage: string;
  userMessage: string;
  fileName: string;
}

/** Laudos e exames simulados (1 clique) para testar a análise educativa e interativa. */
export const SAMPLE_DOCUMENTS: Record<SampleDocumentKind, SampleDocumentScenario> = {
  birads2: {
    kind: 'birads2',
    toastTitle: '📄 Laudo Preparado com Privacidade',
    toastMessage: 'Dados pessoais anonimizados antes do envio para a Doutora Rosa.',
    userMessage:
      'Doutora Rosa, anexei meu laudo de Mamografia Digital: "Paciente: [DADOS_PESSOAIS_OCULTOS]. Mamas simétricas, tecido fibroglandular usual, calcificações tipicamente benignas esparsas. Conclusão: Categoria BI-RADS 2." O que isso significa?',
    fileName: 'laudo_mamografia_birads2.pdf',
  },
  birads3: {
    kind: 'birads3',
    toastTitle: '📄 Laudo Preparado com Privacidade',
    toastMessage: 'Dados sensíveis filtrados e protegidos com segurança.',
    userMessage:
      'Doutora Rosa, anexei meu laudo de Ultrassonografia Mamária: "Nódulo ovalado, circunscrito, paralelo à pele no QSE da mama direita, medindo 0,8 cm. Conclusão: Achado provavelmente benigno — Categoria BI-RADS 3. Controle em 6 meses." Devo ficar preocupada?',
    fileName: 'laudo_ultrassom_birads3.pdf',
  },
  dicom_sample: {
    kind: 'dicom_sample',
    toastTitle: '🔬 Exame de Imagem DICOM Processado',
    toastMessage: 'Metadados e pixels DICOM processados para análise visual e técnica.',
    userMessage:
      'Doutora Rosa, acabei de anexar a imagem médica DICOM mamografia_digital_dcm01.dcm (Modalidade: MG Mamografia Digital, Incidência: Médio-Lateral Oblíqua MLO, Lateralidade: Mama Direita, Matriz: 2048x2560 pixels, 12 bits, MONOCHROME2, parênquima fibroglandular heterogêneo concentrado no quadrante superior externo, músculo peitoral maior bem visibilizado até a altura da papila, pele e complexo aréolo-papilar sem retrações, ausência de massas espiculadas). Faça uma análise objetiva e específica desta imagem.',
    fileName: 'mamografia_digital_dcm01.dcm',
  },
};

export const QUICK_PROMPTS: ReadonlyArray<{ label: string; message: string }> = [
  {
    label: '😟 "Senti um caroço e estou com medo..."',
    message:
      'Doutora Rosa, senti um caroço pequeno na mama hoje e estou com muito medo de ser o pior dos casos. Tem tratamento?',
  },
  {
    label: '💛 "Estou ansiosa pelo resultado do exame..."',
    message: 'Estou muito ansiosa aguardando o resultado da minha mamografia. Como lidar com essa angústia?',
  },
];
