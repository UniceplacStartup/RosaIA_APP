export interface ScientificArticle {
  heading: string;
  title: string;
  credits: string;
}

/** Publicações científicas que fundamentam o Projeto RosaIA. */
export const SCIENTIFIC_ARTICLES: ReadonlyArray<ScientificArticle> = [
  {
    heading: '1. Revista Interdisciplinar de Pesquisa em Engenharia (RIPE / UnB, 2025):',
    title: 'RosaIA – desenvolvimento e validação de um protótipo de inteligência artificial integrada ao WhatsApp para prevenção do câncer de mama',
    credits: '(Sales, Souza, Silva, Galdino, Medeiros, Souto et al.).',
  },
  {
    heading: '2. Revista de Ciências Sociais Aplicadas (RCSA / UNICEPLAC, 2025):',
    title: 'Os desafios éticos, técnicos e sociais na implementação de Chatbots na saúde: um estudo de caso com o Projeto Rosa.IA',
    credits:
      '(Souto, Jovito, Viera, Silva, Sales & Silva) — foco em empatia, privacidade e apoio emocional à paciente e à rede de apoio.',
  },
  {
    heading: '3. Brazilian Journal of Radiation Technology Research (BJRTR, 2026):',
    title: 'Resumo RosaIA APP: proposta de aplicativo com inteligência artificial para prevenção, detecção precoce e apoio ao paciente oncológico',
    credits: '(Sales, Souto, Souza, Silva, Medeiros & Ygor Craveiro Nunes Bueno).',
  },
  {
    heading: '4. II Congresso Nacional de Radiologia (CNR / UNICEPLAC):',
    title: 'Geração Automática de Laudos Radiológicos por Inteligência Artificial: Potenciais e Desafios',
    credits: '(Lucas Souto & Ygor Bueno).',
  },
];

export interface MissionCard {
  title: string;
  text: string;
}

export const MISSION_CARDS: ReadonlyArray<MissionCard> = [
  {
    title: '🎯 Objetivo & Missão',
    text: 'Unir saúde, tecnologia e empatia para oferecer orientação segura sobre saúde mamária, acolhimento emocional inicial e incentivo ao diagnóstico precoce sem substituir o médico.',
  },
  {
    title: '💬 Apoio Psicológico e Rede de Apoio',
    text: 'Desenvolvido para desmistificar o medo do diagnóstico, demonstrando que o câncer de mama tem tratamento eficaz e que o acolhimento reduz a ansiedade e fortalece a adesão terapêutica.',
  },
  {
    title: '📄 Laudos por IA & Ética',
    text: 'Fundamentado nas pesquisas de ARRG (Automated Radiology Report Generation), traduzindo termos radiológicos (BI-RADS) com transparência e proteção estrita da LGPD.',
  },
];
