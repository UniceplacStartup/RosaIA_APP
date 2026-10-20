import { Fragment, useEffect, useRef } from 'react';
import logoRosaia from '../../assets/logo-rosaia.png';
import { useChat } from '../../context/ChatContext';
import ChatInputForm from './ChatInputForm';
import DateGroupChip from './DateGroupChip';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';

/** Janela principal estilo WhatsApp: histórico cronológico por data, digitação, erro/retry e entrada de texto. */
export default function ChatWindow() {
  const { messages, isTyping, isUsingGemini, errorBannerText, jumpRequest, retryLastMessage } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const handledJumpNonce = useRef(jumpRequest?.nonce);

  // Novas mensagens: rola para o final da conversa.
  useEffect(() => {
    const container = scrollRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages]);

  // Salto rápido por data: rola suavemente até o chip correspondente.
  useEffect(() => {
    if (!jumpRequest || jumpRequest.nonce === handledJumpNonce.current) return;
    handledJumpNonce.current = jumpRequest.nonce;
    const container = scrollRef.current;
    if (!container) return;
    const chips = container.querySelectorAll<HTMLElement>('[data-date-chip]');
    const target = Array.from(chips).find((chip) => chip.dataset.dateChip === jumpRequest.dateGroup);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [jumpRequest]);

  let currentGroup: string | null = null;

  return (
    <div className="lg:col-span-8 flex flex-col h-[640px] lg:h-auto">
      {/* Cabeçalho do Chat (RF07) */}
      <div className="bg-white px-4 py-2.5 border-b border-rosa-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={logoRosaia}
              alt="Doutora Rosa"
              className="w-10 h-10 rounded-full bg-rosa-50 p-1 border border-rosa-300 object-contain"
            />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white absolute bottom-0 right-0" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-rosa-900">Doutora Rosa • Assistente Virtual RosaIA</h2>
            <p id="chatStatusSubtitle" className="text-[11px] text-emerald-700 font-medium">
              Online • Respostas baseadas no INCA, Ministério da Saúde e artigos UNICEPLAC
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            id="aiModeIndicator"
            className="text-[11px] px-2.5 py-1 rounded-full bg-rosa-100 text-rosa-800 font-semibold"
          >
            {isUsingGemini ? 'IA: Google Gemini API (Live)' : 'IA: Motor Clínico-Empático RAG'}
          </span>
        </div>
      </div>

      {/* Banner de erro / sem conexão (RF09) */}
      {errorBannerText && (
        <div
          id="chatErrorBanner"
          role="alert"
          className="bg-red-600 text-white px-4 py-2 text-xs flex items-center justify-between"
        >
          <span id="chatErrorText">{errorBannerText}</span>
          <button
            id="btnRetryLastMessage"
            type="button"
            onClick={retryLastMessage}
            className="px-3 py-1 rounded bg-white text-red-700 font-bold text-xs"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Área de mensagens cronológicas (RF08) */}
      <div
        id="chatMessagesContainer"
        ref={scrollRef}
        className="flex-1 p-4 overflow-y-auto whatsapp-bg custom-scroll space-y-3"
      >
        {messages.map((message) => {
          const startsNewGroup = message.dateGroup !== currentGroup;
          currentGroup = message.dateGroup;
          return (
            <Fragment key={message.id}>
              {startsNewGroup && <DateGroupChip dateGroup={message.dateGroup} />}
              <MessageBubble message={message} />
            </Fragment>
          );
        })}
      </div>

      {isTyping && <TypingIndicator />}

      <ChatInputForm />
    </div>
  );
}
