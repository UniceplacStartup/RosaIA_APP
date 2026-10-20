import { useState } from 'react';
import { DELETE_CONFIRMATION_WORD, useAuth } from '../../context/AuthContext';
import ModalShell from './ModalShell';

interface DeleteAccountModalProps {
  onClose: () => void;
}

/** Modal de exclusão permanente de conta com confirmação por digitação de "EXCLUIR" (RF13 / LGPD). */
export default function DeleteAccountModal({ onClose }: DeleteAccountModalProps) {
  const { deleteAccount } = useAuth();
  const [confirmation, setConfirmation] = useState('');

  const handleConfirm = () => {
    if (deleteAccount(confirmation)) onClose();
  };

  return (
    <ModalShell
      id="modalDeleteAccount"
      titleId="deleteModalTitle"
      onClose={onClose}
      panelClassName="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-red-200 space-y-4"
    >
      <h3 id="deleteModalTitle" className="text-base font-extrabold text-red-700">
        ⚠️ Excluir Conta Permanentemente (RF13)
      </h3>
      <p className="text-xs text-gray-700 leading-relaxed">
        Esta ação poderá excluir permanentemente sua conta e seus dados, incluindo o histórico de conversas, conforme o
        Art. 18 da LGPD. Deseja continuar?
      </p>
      <div>
        <label htmlFor="deleteConfirmInput" className="block text-xs font-semibold text-gray-800 mb-1">
          Digite <code>{DELETE_CONFIRMATION_WORD}</code> para confirmar:
        </label>
        <input
          id="deleteConfirmInput"
          type="text"
          autoComplete="off"
          placeholder={DELETE_CONFIRMATION_WORD}
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          className="w-full px-3.5 py-2 rounded-xl border border-red-300 text-xs font-mono"
        />
      </div>
      <div className="flex gap-2 pt-2">
        <button
          id="btnCancelDeleteAccount"
          type="button"
          onClick={onClose}
          className="flex-1 py-2.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs"
        >
          Cancelar
        </button>
        <button
          id="btnConfirmDeleteAccount"
          type="button"
          onClick={handleConfirm}
          className="flex-1 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
        >
          Excluir Permanentemente
        </button>
      </div>
    </ModalShell>
  );
}
