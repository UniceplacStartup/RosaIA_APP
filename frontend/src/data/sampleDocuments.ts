import type { SampleDocumentKind } from '../types/chat';

export interface SampleDocumentScenario {
  kind: Exclude<SampleDocumentKind, 'image_blocked'>;
  toastTitle: string;
  toastMessage: string;
  userMessage: string;
  fileName: string;
}

/** Laudos simulados (1 clique) para testar a análise educativa com anonimização. */
export const SAMPLE_DOCUMENTS: Record<Exclude<SampleDocumentKind, 'image_blocked'>, SampleDocumentScenario> = {
  birads2: {
    kind: 'birads2',
    toastTitle: '📄 Laudo Preparado com Privacidade',
    toastMessage: 'Dados pessoais anonimizados antes do envio para a Doutora Rosa.',
    userMessage:
      'Doutora Rosa, anexei meu laudo de Mamografia Digital: "Paciente: [ANONIMIZADO_LGPD], CPF: [CPF_OCULTO_LGPD]. Mamas simétricas, calcificações tipicamente benignas esparsas. Conclusão: Categoria BI-RADS 2." O que isso significa?',
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
};

export const SIMULATED_IMAGE_BLOCK = {
  toastTitle: '🚫 Formato de Arquivo Não Permitido',
  toastMessage:
    'Por proteção à sua privacidade, não recebemos fotos ou imagens de exames. Envie apenas o texto ou documento em PDF do laudo.',
} as const;

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
