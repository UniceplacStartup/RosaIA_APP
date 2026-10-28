import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useChat } from '../../context/ChatContext';
import { useToast } from '../../context/ToastContext';
import { useExamFileInput } from '../../hooks/useExamFileInput';
import { ALLOWED_DOCUMENT_ACCEPT } from '../../utils/examFileValidator';
import { PaperclipIcon, SendIcon } from '../common/icons';

const MAX_RECORDING_SECONDS = 120;

function pickMimeType(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return candidates.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t));
}

/** Barra de digitação com anexo de laudo, mensagem de voz e botão de envio. */
export default function ChatInputForm() {
  const { sendMessage, sendAudioMessage, isTyping } = useChat();
  const { showToast } = useToast();
  const handleFileChange = useExamFileInput();
  const [draft, setDraft] = useState('');
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelledRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(
    () => () => {
      clearTimer();
      cancelledRef.current = true;
      recorderRef.current?.state === 'recording' && recorderRef.current.stop();
    },
    [],
  );

  const stopRecording = (cancel: boolean) => {
    cancelledRef.current = cancel;
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      showToast('Microfone indisponível', 'Seu navegador não suporta gravação de áudio.', 'error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      cancelledRef.current = false;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        clearTimer();
        setRecording(false);
        setSeconds(0);
        if (cancelledRef.current || chunksRef.current.length === 0) return;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' });
        void sendAudioMessage(blob);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_RECORDING_SECONDS) stopRecording(false);
          return s + 1;
        });
      }, 1000);
    } catch {
      showToast('Permissão negada', 'Permita o acesso ao microfone para enviar mensagens de voz.', 'error');
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (recording) {
      stopRecording(false);
      return;
    }
    if (!draft.trim()) return;
    const text = draft;
    setDraft('');
    void sendMessage(text, null);
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <form id="formChatSend" onSubmit={handleSubmit} className="p-3 bg-white border-t border-rosa-200 flex items-center gap-2">
      <label
        htmlFor="chatAttachInput"
        title="Anexar Laudo ou Imagem de Exame (PDF, DICOM, Imagens)"
        className="cursor-pointer p-2.5 rounded-full bg-rosa-100 hover:bg-rosa-200 text-rosa-800 transition shrink-0"
      >
        <PaperclipIcon className="w-5 h-5" />
        <span className="sr-only">Anexar laudo ou imagem de exame</span>
      </label>
      <input
        id="chatAttachInput"
        type="file"
        accept={ALLOWED_DOCUMENT_ACCEPT}
        onChange={handleFileChange}
        className="hidden"
      />
      {recording ? (
        <div
          id="chatRecordingIndicator"
          className="flex-1 px-4 py-2.5 rounded-full bg-rosa-50 border border-rosa-300 text-sm flex items-center gap-2 text-rosa-900"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="font-semibold">Gravando {mm}:{ss}</span>
          <button
            id="btnCancelRecording"
            type="button"
            onClick={() => stopRecording(true)}
            className="ml-auto text-xs font-bold text-rosa-700 hover:underline"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <input
          id="chatTextInput"
          type="text"
          autoComplete="off"
          placeholder="Digite sua mensagem ou dúvida para a Doutora Rosa..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="flex-1 px-4 py-2.5 rounded-full bg-rosa-50 border border-rosa-300 text-sm focus:outline-none focus:ring-2 focus:ring-rosa-800"
        />
      )}
      {!recording && !draft.trim() && (
        <button
          id="btnRecordAudio"
          type="button"
          onClick={() => void startRecording()}
          disabled={isTyping}
          title="Enviar mensagem de voz"
          aria-label="Gravar mensagem de voz"
          className="p-2.5 rounded-full bg-rosa-100 hover:bg-rosa-200 text-rosa-800 transition shrink-0 disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
          </svg>
        </button>
      )}
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
