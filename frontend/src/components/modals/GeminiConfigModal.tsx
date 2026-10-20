import { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import ModalShell from './ModalShell';

interface GeminiConfigModalProps {
  onClose: () => void;
}

/** Modal de configuração opcional da chave Google AI Studio (gemini-2.5-flash). */
export default function GeminiConfigModal({ onClose }: GeminiConfigModalProps) {
  const { geminiApiKey, saveGeminiKey, clearGeminiKey } = useChat();
  const [keyDraft, setKeyDraft] = useState(geminiApiKey);

  const handleSave = () => {
    saveGeminiKey(keyDraft);
    onClose();
  };

  const handleClear = () => {
    setKeyDraft('');
    clearGeminiKey();
    onClose();
  };

  return (
    <ModalShell
      id="modalConfigIA"
      titleId="geminiModalTitle"
      onClose={onClose}
      panelClassName="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rosa-200 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 id="geminiModalTitle" className="text-base font-extrabold text-rosa-800">
          🤖 Inteligência Artificial da Doutora Rosa
        </h3>
        <button
          id="btnCloseConfigIAModal"
          type="button"
          aria-label="Fechar"
          onClick={onClose}
          className="text-gray-500 hover:text-gray-800 font-bold text-sm"
        >
          ✕
        </button>
      </div>
      <p className="text-xs text-gray-600 leading-relaxed">
        O protótipo já vem com o <strong>Motor Clínico-Empático RAG</strong> funcionando 100% gratuitamente. Se desejar
        conectar diretamente à API em nuvem do <strong>Google Gemini (gemini-2.5-flash)</strong>, cole abaixo uma chave
        gratuita gerada no <code>aistudio.google.com</code>:
      </p>
      <div>
        <label htmlFor="inputGeminiKey" className="block text-xs font-semibold text-rosa-900 mb-1">
          Chave Google AI Studio (Opcional)
        </label>
        <input
          id="inputGeminiKey"
          type="password"
          autoComplete="off"
          placeholder="AIzaSy..."
          value={keyDraft}
          onChange={(e) => setKeyDraft(e.target.value)}
          className="w-full px-3.5 py-2 rounded-xl border border-rosa-300 text-xs font-mono"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          id="btnClearGeminiKey"
          type="button"
          onClick={handleClear}
          className="px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold"
        >
          Usar IA Integrada
        </button>
        <button
          id="btnSaveGeminiKey"
          type="button"
          onClick={handleSave}
          className="px-5 py-2 rounded-full bg-rosa-800 hover:bg-rosa-900 text-white text-xs font-bold"
        >
          Salvar Configuração
        </button>
      </div>
    </ModalShell>
  );
}
