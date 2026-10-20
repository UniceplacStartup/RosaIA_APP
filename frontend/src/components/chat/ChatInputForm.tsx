import { useState } from 'react';
import type { FormEvent } from 'react';
import { useChat } from '../../context/ChatContext';
import { useExamFileInput } from '../../hooks/useExamFileInput';
import { ALLOWED_DOCUMENT_ACCEPT } from '../../utils/examFileValidator';
import { PaperclipIcon, SendIcon } from '../common/icons';

/** Barra de digitação com anexo de laudo (sem imagens) e botão de envio. */
export default function ChatInputForm() {
  const { sendMessage } = useChat();
  const handleFileChange = useExamFileInput();
  const [draft, setDraft] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.trim()) return;
    const text = draft;
    setDraft('');
    void sendMessage(text, null);
  };

  return (
    <form id="formChatSend" onSubmit={handleSubmit} className="p-3 bg-white border-t border-rosa-200 flex items-center gap-2">
      <label
        htmlFor="chatAttachInput"
        title="Anexar Exame/Laudo em PDF ou Texto (Imagens Proibidas)"
        className="cursor-pointer p-2.5 rounded-full bg-rosa-100 hover:bg-rosa-200 text-rosa-800 transition shrink-0"
      >
        <PaperclipIcon className="w-5 h-5" />
        <span className="sr-only">Anexar laudo em PDF ou texto</span>
      </label>
      <input
        id="chatAttachInput"
        type="file"
        accept={ALLOWED_DOCUMENT_ACCEPT}
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        id="chatTextInput"
        type="text"
        autoComplete="off"
        placeholder="Digite sua mensagem ou dúvida para a Doutora Rosa..."
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="flex-1 px-4 py-2.5 rounded-full bg-rosa-50 border border-rosa-300 text-sm focus:outline-none focus:ring-2 focus:ring-rosa-800"
      />
      <button
        id="btnSendChat"
        type="submit"
        className="px-5 py-2.5 rounded-full bg-rosa-800 hover:bg-rosa-900 text-white font-bold text-sm shadow transition flex items-center gap-1.5 shrink-0"
      >
        <span>Enviar</span>
        <SendIcon className="w-4 h-4" />
      </button>
    </form>
  );
}
