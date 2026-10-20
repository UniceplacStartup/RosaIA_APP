import { Fragment } from 'react';
import type { ReactNode } from 'react';
import type { ChatMessage } from '../../types/chat';

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

/** Balão estilizado: usuária (à direita, rosa escuro) vs. Doutora Rosa (à esquerda, branco). */
export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.sender === 'user';

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
            <span className="font-extrabold text-xs text-rosa-800">🌸 Doutora Rosa</span>
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

        <div className={`flex items-center justify-end gap-1 text-[10px] ${isUser ? 'text-rosa-200' : 'text-gray-400'}`}>
          <span>{message.time}</span>
          {isUser && <span>✓✓</span>}
        </div>
      </div>
    </div>
  );
}
