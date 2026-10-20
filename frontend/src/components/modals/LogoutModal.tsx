import { useAuth } from '../../context/AuthContext';
import ModalShell from './ModalShell';

interface LogoutModalProps {
  onClose: () => void;
}

/** Modal de confirmação de logout (RF12). */
export default function LogoutModal({ onClose }: LogoutModalProps) {
  const { logout } = useAuth();

  const handleConfirm = () => {
    onClose();
    logout();
  };

  return (
    <ModalShell
      id="modalLogout"
      titleId="logoutModalTitle"
      onClose={onClose}
      panelClassName="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-rosa-200 space-y-4 text-center"
    >
      <h3 id="logoutModalTitle" className="text-base font-extrabold text-rosa-800">
        Deseja realmente sair da sua conta?
      </h3>
      <p className="text-xs text-gray-600">
        Seu histórico de conversas permanecerá salvo com segurança para quando você voltar.
      </p>
      <div className="flex gap-2 pt-2">
        <button
          id="btnCancelLogout"
          type="button"
          onClick={onClose}
          className="flex-1 py-2.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs"
        >
          Cancelar
        </button>
        <button
          id="btnConfirmLogout"
          type="button"
          onClick={handleConfirm}
          className="flex-1 py-2.5 rounded-full bg-rosa-800 hover:bg-rosa-900 text-white font-bold text-xs"
        >
          Sair
        </button>
      </div>
    </ModalShell>
  );
}
