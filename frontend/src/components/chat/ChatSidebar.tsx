import logoRosaia from '../../assets/logo-rosaia.png';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { JUMP_DATE_GROUPS } from '../../data/seedData';
import { QUICK_PROMPTS } from '../../data/sampleDocuments';
import type { EmotionTone } from '../../types/chat';
import ExamUploadBox from './ExamUploadBox';

const BADGE_TONE_CLASSES: Record<EmotionTone, string> = {
  default: 'bg-emerald-100 text-emerald-800 font-semibold',
  attention: 'bg-amber-100 text-amber-900 font-bold',
  support: 'bg-rosa-200 text-rosa-900 font-bold',
  info: 'bg-blue-100 text-blue-900 font-bold',
};

/** Sidebar estilo WhatsApp: histórico por data, estado emocional (RF07) e upload de laudos. */
export default function ChatSidebar() {
  const { user } = useAuth();
  const { messages, emotionMonitor, sendMessage, jumpToDate } = useChat();

  const lastMessage = messages[messages.length - 1];
  const lastTime = lastMessage ? (lastMessage.dateGroup === 'Hoje' ? lastMessage.time : lastMessage.dateGroup) : 'Agora';
  const lastPreview = lastMessage ? lastMessage.text : 'Estou aqui para acolher você e tirar dúvidas...';

  return (
    <aside className="lg:col-span-4 border-r border-rosa-200 bg-rosa-50/70 flex flex-col justify-between p-4 space-y-4">
      <div className="space-y-4">
        {/* Card da Conversa Contínua */}
        <div className="bg-white rounded-2xl p-3.5 border border-rosa-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rosa-800">Conversa Recorrente Ativa</span>
            <span className="text-[11px] text-emerald-700 font-semibold">Iniciada em 02/09/2026</span>
          </div>
          <div className="flex items-center gap-3 p-2 rounded-xl bg-rosa-100/70 border border-rosa-300">
            <img
              src={logoRosaia}
              alt="Avatar Doutora Rosa"
              className="w-11 h-11 rounded-full bg-white p-1 object-contain shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <p className="font-bold text-sm text-rosa-900 truncate">Doutora Rosa (IA)</p>
                <span id="sidebarLastTime" className="text-[10px] text-rosa-700 font-semibold">
                  {lastTime}
                </span>
              </div>
              <p id="sidebarLastPreview" className="text-xs text-gray-600 truncate">
                {lastPreview}
              </p>
            </div>
          </div>

          {/* Salto rápido por data */}
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-gray-500">Ir para data:</span>
            {JUMP_DATE_GROUPS.map((dateGroup) => (
              <button
                key={dateGroup}
                type="button"
                data-jump-date={dateGroup}
                onClick={() => jumpToDate(dateGroup)}
                className={`jump-date-btn text-[11px] px-2 py-0.5 rounded-full font-semibold transition ${
                  dateGroup === 'Hoje'
                    ? 'bg-rosa-800 text-white'
                    : 'bg-rosa-200 hover:bg-rosa-300 text-rosa-900'
                }`}
              >
                {dateGroup}
              </button>
            ))}
          </div>
        </div>

        {/* Monitor de Apoio Psicológico */}
        <div className="bg-white rounded-2xl p-3.5 border border-rosa-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rosa-800">💙 Monitor de Apoio Emocional</span>
            <span
              id="emotionBadge"
              className={`text-[11px] px-2 py-0.5 rounded-full ${BADGE_TONE_CLASSES[emotionMonitor.tone]}`}
            >
              {emotionMonitor.badgeLabel}
            </span>
          </div>
          <p id="emotionExplanation" className="text-xs text-gray-600 leading-relaxed">
            {emotionMonitor.explanation === 'fear_symptom' ? (
              <>
                Detectamos <strong>medo/ansiedade associado a sintoma físico</strong>. Protocolo de acolhimento
                UNICEPLAC ativado para tranquilizar a paciente e orientar avaliação médica sem pânico.
              </>
            ) : (
              <>
                A Doutora Rosa identifica sinais de medo, ansiedade ou angústia e responde com acolhimento humanizado,
                lembrando que <strong>não é o pior dos casos</strong>, que há tratamento eficaz e que o diagnóstico
                precoce salva vidas.
              </>
            )}
          </p>
          <div className="pt-1 flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt.label}
                type="button"
                data-quick-msg={prompt.message}
                onClick={() => void sendMessage(prompt.message, null)}
                className="quick-prompt-btn text-[11px] bg-rosa-100 hover:bg-rosa-200 text-rosa-900 px-2.5 py-1 rounded-lg text-left transition"
              >
                {prompt.label}
              </button>
            ))}
          </div>
        </div>

        <ExamUploadBox />
      </div>

      {/* Rodapé da Sidebar */}
      <div className="pt-2 border-t border-rosa-200 flex items-center justify-between text-[11px] text-gray-600">
        <span>
          Usuária: <strong id="sidebarUserName" className="text-rosa-900">{user.fullName}</strong>
        </span>
        <span className="text-emerald-700 font-medium">● Conectada</span>
      </div>
    </aside>
  );
}
