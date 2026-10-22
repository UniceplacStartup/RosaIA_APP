import type { ChatMessage } from '../types/chat';
import type { Reminder } from '../types/reminder';
import type { User } from '../types/auth';

/** Conta de demonstração (Maria da Silva) — dados mockados do protótipo original. */
export const DEMO_USER: User = {
  fullName: 'Maria da Silva',
  email: 'maria.silva@exemplo.com',
  cpfMasked: '***.456.789-**',
  cpfHash: '8f9d2a7e4b1c6d0e3f5a9b2c4d6e8f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e',
};

export const DEMO_PASSWORD = 'Rosa@2026';

/** Chips de data para salto rápido no histórico. */
export const JUMP_DATE_GROUPS: ReadonlyArray<string> = ['02/09/2026', '15/09/2026', 'Hoje'];

/** Histórico inicial recorrente estilo WhatsApp (conversa iniciada em 02/09). */
export const INITIAL_MESSAGES: ReadonlyArray<ChatMessage> = [
  {
    id: 'm1',
    dateGroup: '02/09/2026',
    time: '09:14',
    sender: 'doutora_rosa',
    text: 'Olá, Maria! 🌸 Seja muito bem-vinda ao RosaIA. Eu sou a Doutora Rosa, sua assistente virtual de acolhimento e educação em saúde mamária. Nossa conversa fica salva aqui para você me chamar sempre que precisar, dia após dia. Como você está se sentindo hoje?',
  },
  {
    id: 'm2',
    dateGroup: '02/09/2026',
    time: '09:16',
    sender: 'user',
    text: 'Oi Doutora Rosa! Comecei a usar hoje porque minha médica pediu minha mamografia de rotina e confesso que fico um pouco tensa só de pensar em fazer exames.',
  },
  {
    id: 'm3',
    dateGroup: '02/09/2026',
    time: '09:16',
    sender: 'doutora_rosa',
    emotionTag: 'Acolhimento Psicológico • Redução de Ansiedade',
    text: 'É completamente natural sentir esse frio na barriga, Maria! 💛 Quero te tranquilizar: fazer a mamografia de rotina é um gesto de amor e cuidado com você mesma. E lembre-se sempre: a imensa maioria dos exames de rotina traz resultados normais ou benignos, e mesmo quando alguma alteração é identificada cedo, as taxas de sucesso no tratamento ultrapassam 95% segundo o INCA. Estou aqui com você em cada passo!',
  },
  {
    id: 'm4',
    dateGroup: '15/09/2026',
    time: '18:40',
    sender: 'user',
    text: 'Doutora, passei aqui para contar que fiz o exame hoje! Agora estou aguardando sair o laudo em PDF para te mostrar.',
  },
  {
    id: 'm5',
    dateGroup: '15/09/2026',
    time: '18:40',
    sender: 'doutora_rosa',
    emotionTag: 'Apoio Contínuo • Incentivo ao Autocuidado',
    text: 'Que notícia maravilhosa, Maria! Parabéns por cuidar da sua saúde! 👏🌸 Assim que o seu laudo ou exame sair (em PDF, texto ou imagem médica/DICOM), você pode anexar o arquivo aqui no clipe. Seus dados pessoais são higienizados com total segurança e eu te ajudo a entender cada detalhe descritivo com carinho!',
  },
  {
    id: 'm6',
    dateGroup: 'Hoje',
    time: '17:20',
    sender: 'doutora_rosa',
    text: 'Olá de novo, Maria! Vi que você entrou hoje. Surgiu alguma dúvida nova, quer conversar sobre como está se sentindo ou deseja anexar o documento do seu exame para conversarmos?',
  },
];

export const INITIAL_REMINDERS: ReadonlyArray<Reminder> = [
  { id: 'r1', tipo: 'Exame', titulo: 'Buscar laudo da Mamografia Bilateral', data: '2026-10-18', concluido: false },
  { id: 'r2', tipo: 'Consulta', titulo: 'Retorno com Mastologista (Levar laudo)', data: '2026-10-25', concluido: false },
  { id: 'r3', tipo: 'Autocuidado', titulo: 'Momento de respiração e observação corporal', data: '2026-11-02', concluido: true },
];

/** Data padrão sugerida no formulário de novo lembrete. */
export const DEFAULT_REMINDER_DATE = '2026-10-25';
