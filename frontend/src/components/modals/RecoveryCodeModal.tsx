import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { copyToClipboard } from '../../utils/clipboard';
import ModalShell from './ModalShell';

interface RecoveryCodeModalProps {
  onClose: () => void;
}

function downloadRecoveryCodeFile(code: string, email: string): void {
  const content = [
    'RosaIA APP — Código de Recuperação de Senha',
    '===========================================',
    `Conta: ${email}`,
    `Código de Recuperação: ${code}`,
    '',
    'Guarde este arquivo em um local seguro.',
    'Este código é de uso único: ao redefinir sua senha, um novo código será gerado automaticamente.',
  ].join('\n');

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'rosaia_codigo_recuperacao.txt';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Modal de Código de Recuperação:
 * 1. Exibe o código recém-gerado no cadastro (exibição única).
 * 2. Orienta contas existentes a gerarem seu primeiro código no próximo login.
 * 3. Permite gerar um novo código nas Configurações/Perfil (exigindo a senha atual).
 */
export default function RecoveryCodeModal({ onClose }: RecoveryCodeModalProps) {
  const {
    user,
    pendingRecoveryCode,
    clearPendingRecoveryCode,
    needsRecoveryCodeSetup,
    dismissRecoveryCodeSetup,
    generateRecoveryCode,
  } = useAuth();
  const { showToast } = useToast();

  const [generatedCode, setGeneratedCode] = useState<string | null>(pendingRecoveryCode);
  const [savedConfirmed, setSavedConfirmed] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeCode = generatedCode || pendingRecoveryCode;
  const isFirstTimeSetup = !user.hasRecoveryCode || needsRecoveryCodeSetup;

  const handleClose = () => {
    if (activeCode && !savedConfirmed) {
      showToast(
        'Confirme que salvou o código',
        'Marque a caixa de confirmação após anotar ou baixar seu código de recuperação.',
        'warning',
      );
      return;
    }
    clearPendingRecoveryCode();
    dismissRecoveryCodeSetup();
    onClose();
  };

  const handleDeferSetup = () => {
    dismissRecoveryCodeSetup();
    onClose();
  };

  const handleCopy = async () => {
    if (!activeCode) return;
    const ok = await copyToClipboard(activeCode);
    if (ok) {
      showToast('Código Copiado', 'Cole e guarde seu código em um local seguro.', 'success');
    } else {
      showToast('Atenção', 'Selecione e copie o código manualmente.', 'warning');
    }
  };

  const handleDownload = () => {
    if (!activeCode) return;
    downloadRecoveryCodeFile(activeCode, user.email);
    showToast('Arquivo Baixado', 'Arquivo rosaia_codigo_recuperacao.txt salvo no seu dispositivo.', 'success');
  };

  const handleGenerateFirstTime = async () => {
    setErrorMsg(null);
    setIsLoading(true);
    const res = await generateRecoveryCode();
    setIsLoading(false);
    if (res.ok && res.code) {
      setGeneratedCode(res.code);
      setSavedConfirmed(false);
    } else if (res.error) {
      setErrorMsg(res.error);
    }
  };

  const handleRotateSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!currentPassword.trim()) {
      setErrorMsg('Informe sua senha atual para confirmar a troca do código.');
      return;
    }
    setIsLoading(true);
    const res = await generateRecoveryCode(currentPassword);
    setIsLoading(false);
    if (res.ok && res.code) {
      setGeneratedCode(res.code);
      setCurrentPassword('');
      setSavedConfirmed(false);
    } else if (res.error) {
      setErrorMsg(res.error);
    }
  };

  return (
    <ModalShell
      id="recoveryCodeModal"
      titleId="recoveryCodeModalTitle"
      panelClassName="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rosa-200 space-y-4"
      onClose={activeCode ? handleClose : handleDeferSetup}
    >
      {activeCode ? (
        <>
          <div className="space-y-1">
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
              🔐 Código de Recuperação (Exibição Única)
            </span>
            <h3 id="recoveryCodeModalTitle" className="text-lg font-extrabold text-rosa-900">
              Guarde seu código em um local seguro
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Use este código caso esqueça sua senha. Por segurança, armazenamos apenas o hash criptográfico e ele{' '}
              <strong>não poderá ser exibido novamente</strong>.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-rosa-50 border-2 border-dashed border-rosa-300 text-center space-y-2">
            <div
              id="recoveryCodeDisplay"
              className="font-mono text-xl sm:text-2xl font-extrabold tracking-widest text-rosa-900 select-all"
            >
              {activeCode}
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopy}
                className="px-3.5 py-1.5 rounded-full bg-white hover:bg-rosa-100 text-rosa-900 border border-rosa-300 text-xs font-bold transition"
              >
                📋 Copiar código
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="px-3.5 py-1.5 rounded-full bg-white hover:bg-rosa-100 text-rosa-900 border border-rosa-300 text-xs font-bold transition"
              >
                💾 Baixar .txt
              </button>
            </div>
          </div>

          <label className="flex items-start gap-2.5 text-xs text-gray-700 cursor-pointer bg-gray-50 p-3 rounded-xl border border-gray-200">
            <input
              type="checkbox"
              checked={savedConfirmed}
              onChange={(e) => setSavedConfirmed(e.target.checked)}
              className="mt-0.5 accent-rosa-800 w-4 h-4 rounded"
            />
            <span>
              Confirmo que já anotei, copiei ou baixei meu código de recuperação em um local seguro.
            </span>
          </label>

          <button
            type="button"
            disabled={!savedConfirmed}
            onClick={handleClose}
            className="w-full py-2.5 rounded-full bg-rosa-800 hover:bg-rosa-900 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold text-sm transition"
          >
            Concluir
          </button>
        </>
      ) : isFirstTimeSetup ? (
        <>
          <div className="space-y-1">
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold">
              🛡️ Proteja o Acesso à Sua Conta
            </span>
            <h3 id="recoveryCodeModalTitle" className="text-lg font-extrabold text-rosa-900">
              Configure seu Código de Recuperação
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Sua conta foi criada antes da ativação dos códigos de recuperação. Gere agora um código pessoal para
              poder redefinir sua senha com autonomia caso um dia precise.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
              {errorMsg}
            </div>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              disabled={isLoading}
              onClick={handleGenerateFirstTime}
              className="w-full py-2.5 rounded-full bg-rosa-800 hover:bg-rosa-900 disabled:opacity-60 text-white font-bold text-sm transition"
            >
              {isLoading ? 'Gerando código...' : '🔐 Gerar Meu Código de Recuperação'}
            </button>
            <button
              type="button"
              onClick={handleDeferSetup}
              className="w-full py-2 rounded-full bg-white hover:bg-gray-100 text-gray-600 text-xs font-semibold transition"
            >
              Fazer depois (disponível no Perfil)
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={handleRotateSubmit} className="space-y-4">
          <div className="space-y-1">
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-rosa-100 text-rosa-900 text-[11px] font-bold">
              🔑 Substituir Código de Recuperação
            </span>
            <h3 id="recoveryCodeModalTitle" className="text-lg font-extrabold text-rosa-900">
              Gerar Novo Código
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Ao gerar um novo código, o anterior será imediatamente invalidado. Confirme sua senha atual para
              continuar.
            </p>
          </div>

          <div>
            <label htmlFor="rotateRecoveryPassword" className="block text-xs font-bold text-gray-700 mb-1">
              Senha atual <span className="text-red-600">*</span>
            </label>
            <input
              id="rotateRecoveryPassword"
              type="password"
              autoComplete="current-password"
              placeholder="Digite sua senha atual"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-rosa-300 text-sm focus:outline-none focus:ring-2 focus:ring-rosa-500"
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
              {errorMsg}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={handleDeferSetup}
              className="px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 rounded-full bg-rosa-800 hover:bg-rosa-900 disabled:opacity-60 text-white text-xs font-bold transition"
            >
              {isLoading ? 'Gerando...' : 'Gerar Novo Código'}
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  );
}
