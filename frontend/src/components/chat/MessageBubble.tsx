import { Fragment, useState } from 'react';
import type { ReactNode } from 'react';
import type { ChatMessage } from '../../types/chat';
import { useChat } from '../../context/ChatContext';

interface MessageBubbleProps {
  message: ChatMessage;
}

const INLINE_MARKDOWN = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;

/**
 * Renderiza o subconjunto de markdown usado pela Doutora Rosa (**negrito** e *itálico*)
 * como elementos React — sem `dangerouslySetInnerHTML`, evitando XSS em texto de usuária/IA.
 */
function renderInlineMarkdown(text: string): ReactNode[] {
  return text.split(INLINE_MARKDOWN).map((part, index) => {
    if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

/** Balão estilizado: usuária (à direita, rosa escuro) vs. Doutora Rosa (à esquerda, branco com feedback). */
export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.sender === 'user';
  const { submitFeedback } = useChat();
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [pendingRating, setPendingRating] = useState<number | null>(null);
  const [commentText, setCommentText] = useState('');
  const [allowTraining, setAllowTraining] = useState(false);

  const handleRate = (rating: number) => {
    if (message.userRating === rating) return;
    setPendingRating(rating);
    setShowFeedbackModal(true);
  };

  const handleConfirmFeedback = async () => {
    if (pendingRating !== null) {
      await submitFeedback(message.id, pendingRating, commentText.trim() || undefined, allowTraining);
    }
    setShowFeedbackModal(false);
  };

  const handleQuickRate = async (rating: number) => {
    if (message.userRating === rating) return;
    await submitFeedback(message.id, rating, undefined, false);
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={
          isUser
            ? 'max-w-[82%] sm:max-w-[72%] rounded-2xl rounded-tr-none bg-rosa-800 text-white px-4 py-2.5 shadow-md text-xs sm:text-sm space-y-1'
            : 'max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tl-none bg-white text-gray-800 px-4 py-3 shadow-md border border-rosa-200 text-xs sm:text-sm space-y-1.5'
        }
      >
        {!isUser && (
          <div className="flex items-center justify-between gap-2 border-b border-rosa-100 pb-1">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xs text-rosa-800">🌸 Doutora Rosa</span>
              {message.usedFallback && (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200" title="Resposta em modo contingente seguro">
                  Contingência
                </span>
              )}
            </div>
            {message.emotionTag && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rosa-100 text-rosa-800 font-semibold">
                {message.emotionTag}
              </span>
            )}
          </div>
        )}

        {message.docAttachment && (
          <div
            className={`p-2 rounded-xl ${
              isUser ? 'bg-rosa-900/70 text-rosa-100' : 'bg-rosa-50 text-rosa-900 border border-rosa-200'
            } text-xs flex items-center gap-2`}
          >
            <span>
              📄 <strong>Documento Anonimizado (LGPD):</strong> {message.docAttachment}
            </span>
          </div>
        )}

        <div className="leading-relaxed whitespace-pre-line">{renderInlineMarkdown(message.text)}</div>

        {/* Rodapé: Horário + Ações de Feedback da Resposta */}
        <div className={`flex items-center justify-between pt-1 text-[10px] ${isUser ? 'text-rosa-200 justify-end' : 'text-gray-400'}`}>
          {!isUser && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400">Essa resposta ajudou?</span>
              <button
                type="button"
                onClick={() => handleRate(1)}
                className={`px-1.5 py-0.5 rounded transition ${
                  message.userRating === 1
                    ? 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-300'
                    : 'hover:bg-gray-100 text-gray-600'
                }`}
                title="Resposta útil e acolhedora"
              >
                👍
              </button>
              <button
                type="button"
                onClick={() => handleRate(-1)}
                className={`px-1.5 py-0.5 rounded transition ${
                  message.userRating === -1
                    ? 'bg-rose-100 text-rose-800 font-bold border border-rose-300'
                    : 'hover:bg-gray-100 text-gray-600'
                }`}
                title="Pode melhorar ou não respondeu a dúvida"
              >
                👎
              </button>
            </div>
          )}

          <div className="flex items-center gap-1">
            <span>{message.time}</span>
            {isUser && <span>✓✓</span>}
          </div>
        </div>

        {/* Mini modal / expansão de comentário e consentimento LGPD para treino */}
        {showFeedbackModal && (
          <div className="mt-2 pt-2 border-t border-rosa-100 text-left bg-rosa-50/60 p-2.5 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-rosa-900">
              <span>{pendingRating === 1 ? '🌸 Que ótimo! Quer comentar algo?' : '🩺 Sentimos muito. Como podemos melhorar?'}</span>
              <button
                type="button"
                onClick={() => setShowFeedbackModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xs"
              >
                ✕
              </button>
            </div>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Comentário opcional (anonimizado automaticamente)..."
              rows={2}
              className="w-full text-xs p-2 rounded-lg border border-rosa-200 focus:outline-none focus:ring-1 focus:ring-rosa-500 bg-white"
            />
            <label className="flex items-start gap-1.5 text-[11px] text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={allowTraining}
                onChange={(e) => setAllowTraining(e.target.checked)}
                className="mt-0.5 rounded text-rosa-600 focus:ring-rosa-400"
              />
              <span>Autorizo o uso anônimo (LGPD) deste par de pergunta/resposta para supervisão e melhoria contínua da IA.</span>
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleQuickRate(pendingRating!)}
                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
              >
                Enviar sem comentário
              </button>
              <button
                type="button"
                onClick={handleConfirmFeedback}
                className="px-3 py-1 text-xs font-semibold rounded-lg bg-rosa-700 hover:bg-rosa-800 text-white shadow-sm"
              >
                Salvar Avaliação
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
