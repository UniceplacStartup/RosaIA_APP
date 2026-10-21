import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useReminders } from '../../context/ReminderContext';
import { useToast } from '../../context/ToastContext';
import { useUi } from '../../context/UiContext';
import { buildLgpdExport, downloadJson } from '../../utils/dataExport';
import { getInitials } from '../../utils/format';

/** Perfil da titular + direitos LGPD (Art. 18): portabilidade, logout e exclusão permanente. */
export default function ProfileSection() {
  const { user } = useAuth();
  const { messages } = useChat();
  const { reminders } = useReminders();
  const { showToast } = useToast();
  const { openModal } = useUi();

  const handleExport = () => {
    const payload = buildLgpdExport(user, messages, reminders);
    const day = new Date().toISOString().slice(0, 10);
    downloadJson(`rosaia_meus_dados_${day}.json`, payload);
    showToast('Portabilidade LGPD (Art. 18)', 'Relatório JSON com seus dados e histórico preparado com sucesso.', 'success');
  };

  return (
    <section id="tabContentPerfil" className="p-6 bg-rosa-50/40">
      <div className="max-w-xl mx-auto bg-white rounded-3xl p-6 border border-rosa-200 shadow-sm space-y-5">
        <div className="flex items-center gap-4 border-b border-rosa-100 pb-4">
          <div
            id="perfilInitials"
            className="w-16 h-16 rounded-full bg-rosa-100 border-2 border-rosa-800 flex items-center justify-center text-rosa-800 font-extrabold text-xl"
          >
            {getInitials(user.fullName)}
          </div>
          <div>
            <h2 id="perfilNomeDisplay" className="text-xl font-extrabold text-rosa-900">
              {user.fullName}
            </h2>
            <p id="perfilEmailDisplay" className="text-xs text-gray-600">
              {user.email}
            </p>
            <p className="text-[11px] text-emerald-700 font-mono mt-0.5">
              CPF Protegido (LGPD): <span id="perfilCpfMasked">{user.cpfMasked}</span>
            </p>
          </div>
        </div>

        <div className="space-y-2 text-xs bg-rosa-50 p-4 rounded-2xl border border-rosa-200">
          <div className="font-bold text-rosa-900">Direitos do Titular de Dados (Art. 18 da LGPD — Lei nº 13.709/2018)</div>
          <p className="text-gray-700">
            Seus dados sensíveis de saúde são anonimizados antes do processamento pela IA e seu CPF é armazenado apenas
            como hash HMAC-SHA256 e cifra AES-256.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            id="btnExportarDadosLgpd"
            type="button"
            onClick={handleExport}
            className="py-2.5 px-4 rounded-full bg-rosa-100 hover:bg-rosa-200 text-rosa-900 font-bold text-xs transition"
          >
            📥 Exportar Meu Histórico (Portabilidade)
          </button>
          <button
            id="btnOpenLogoutModal"
            type="button"
            onClick={() => openModal('logout')}
            className="py-2.5 px-4 rounded-full bg-white hover:bg-gray-100 text-rosa-800 border border-rosa-800 font-bold text-xs transition"
          >
            🚪 Sair da Conta
          </button>
        </div>

        <div className="pt-4 border-t border-rosa-200">
          <button
            id="btnOpenDeleteAccountModal"
            type="button"
            onClick={() => openModal('deleteAccount')}
            className="w-full py-2.5 px-4 rounded-full bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 font-bold text-xs transition"
          >
            🗑️ Excluir Minha Conta e Dados Pessoais
          </button>
        </div>
      </div>
    </section>
  );
}
