import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { copyToClipboard } from '../../utils/clipboard';
import { evaluatePassword, isStrongPassword, toRuleItems } from '../../utils/passwordValidator';
import { AUTH_INPUT_LARGE_CLASS, AUTH_LABEL_CLASS } from './formStyles';
import PasswordRequirementList from './PasswordRequirementList';

function downloadNewCode(code: string, identifier: string): void {
  const content = [
    'RosaIA APP — Novo Código de Recuperação de Senha',
    '================================================',
    `Conta: ${identifier}`,
    `Novo Código de Recuperação: ${code}`,
    '',
    'O código anterior foi invalidado após a redefinição de senha.',
    'Guarde este novo código em um local seguro.',
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

/** Tela 05 — Redefinição de senha com código de recuperação de uso único (100% código próprio). */
export default function PasswordResetView() {
  const { resetPasswordWithCode, setAuthView } = useAuth();
  const { showToast } = useToast();

  const [identifier, setIdentifier] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [newRecoveryCode, setNewRecoveryCode] = useState<string | null>(null);
  const [showNoCodeHelp, setShowNoCodeHelp] = useState(false);

  const passwordReq = useMemo(
    () => evaluatePassword(newPassword, confirmPassword),
    [newPassword, confirmPassword],
  );
  const passwordRules = useMemo(() => toRuleItems(passwordReq), [passwordReq]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMsg(null);

    if (!identifier.trim()) {
      setErrorMsg('Informe o e-mail ou CPF cadastrado.');
      return;
    }
    if (recoveryCode.replace(/[^A-Za-z0-9]/g, '').length < 8) {
      setErrorMsg('Informe seu código de recuperação completo (ex: XXXX-XXXX-XXXX-XXXX).');
      return;
    }
    if (!isStrongPassword(passwordReq) || !passwordReq.matches) {
      setErrorMsg('A nova senha precisa atender a todos os requisitos de segurança e coincidir com a confirmação.');
      return;
    }

    setIsSubmitting(true);
    const result = await resetPasswordWithCode({
      identifier,
      recoveryCode,
      newPassword,
      confirmPassword,
    });
    setIsSubmitting(false);

    if (result.ok && result.newRecoveryCode) {
      setNewRecoveryCode(result.newRecoveryCode);
    } else if (result.error) {
      setErrorMsg(result.error);
    }
  };

  const handleCopyNewCode = async () => {
    if (!newRecoveryCode) return;
    const ok = await copyToClipboard(newRecoveryCode);
    if (ok) {
      showToast('Código Copiado', 'Guarde seu novo código de recuperação em um local seguro.', 'success');
    }
  };

  if (newRecoveryCode) {
    return (
      <section id="authViewRecuperar" className="space-y-4">
        <div className="space-y-1">
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
            ✓ Senha Atualizada
          </span>
          <h2 className="text-2xl font-extrabold text-rosa-800">Senha Redefinida com Sucesso!</h2>
          <p className="text-xs text-gray-600 leading-relaxed">
            Como o código anterior era de uso único, geramos um <strong>novo código de recuperação</strong> para você.
            Salve-o antes de voltar ao login — ele não será exibido novamente.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-rosa-50 border-2 border-dashed border-rosa-300 text-center space-y-2">
          <div className="font-mono text-xl font-extrabold tracking-widest text-rosa-900 select-all">
            {newRecoveryCode}
          </div>
          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleCopyNewCode}
              className="px-3.5 py-1.5 rounded-full bg-white hover:bg-rosa-100 text-rosa-900 border border-rosa-300 text-xs font-bold transition"
            >
              📋 Copiar código
            </button>
            <button
              type="button"
              onClick={() => downloadNewCode(newRecoveryCode, identifier)}
              className="px-3.5 py-1.5 rounded-full bg-white hover:bg-rosa-100 text-rosa-900 border border-rosa-300 text-xs font-bold transition"
            >
              💾 Baixar .txt
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAuthView('login')}
          className="w-full py-3 rounded-full bg-rosa-800 hover:bg-rosa-900 text-white font-bold text-sm shadow transition"
        >
          Ir para o Login →
        </button>
      </section>
    );
  }

  return (
    <section id="authViewRecuperar" className="space-y-4">
      <div>
        <h2 className="text-2xl font-extrabold text-rosa-800">Redefinir Senha</h2>
        <p className="text-xs text-gray-600 leading-relaxed mt-1">
          Informe seu e-mail ou CPF e o <strong>código de recuperação</strong> salvo no cadastro para criar uma nova senha.
        </p>
      </div>

      <form id="formRecuperar" className="space-y-3" noValidate onSubmit={handleSubmit}>
        <div>
          <label htmlFor="recEmail" className={AUTH_LABEL_CLASS}>
            E-mail ou CPF cadastrado <span className="text-red-600">*</span>
          </label>
          <input
            id="recEmail"
            type="text"
            autoComplete="username"
            placeholder="seuemail@exemplo.com ou 000.000.000-00"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className={AUTH_INPUT_LARGE_CLASS}
          />
        </div>

        <div>
          <label htmlFor="recCode" className={AUTH_LABEL_CLASS}>
            Código de recuperação <span className="text-red-600">*</span>
          </label>
          <input
            id="recCode"
            type="text"
            autoComplete="off"
            placeholder="XXXX-XXXX-XXXX-XXXX"
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
            className={`${AUTH_INPUT_LARGE_CLASS} font-mono tracking-wider uppercase`}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="recNewPassword" className={AUTH_LABEL_CLASS}>
              Nova senha <span className="text-red-600">*</span>
            </label>
            <input
              id="recNewPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={AUTH_INPUT_LARGE_CLASS}
            />
          </div>
          <div>
            <label htmlFor="recConfirmPassword" className={AUTH_LABEL_CLASS}>
              Confirmar nova senha <span className="text-red-600">*</span>
            </label>
            <input
              id="recConfirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Repita a nova senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={AUTH_INPUT_LARGE_CLASS}
            />
          </div>
        </div>

        <PasswordRequirementList rules={passwordRules} />

        {errorMsg && (
          <div
            id="recFeedbackBox"
            role="alert"
            className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium"
          >
            {errorMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 rounded-full bg-rosa-800 hover:bg-rosa-900 disabled:opacity-60 text-white font-bold text-sm shadow transition"
        >
          {isSubmitting ? 'Redefinindo senha...' : 'Redefinir Senha Agora'}
        </button>
      </form>

      <div className="pt-1 space-y-2">
        <button
          type="button"
          onClick={() => setShowNoCodeHelp((prev) => !prev)}
          className="text-xs text-gray-600 hover:text-rosa-800 font-semibold underline block"
        >
          {showNoCodeHelp ? 'Ocultar ajuda' : 'Não tenho meu código de recuperação'}
        </button>

        {showNoCodeHelp && (
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
            Se você perdeu seu código de recuperação ou criou sua conta antes da ativação desse recurso (e ainda não
            gerou um código no Perfil), entre em contato com a equipe de suporte/administração do RosaIA para
            redefinição manual segura.
          </div>
        )}

        <button
          id="btnBackToLoginFromRec"
          type="button"
          onClick={() => setAuthView('login')}
          className="text-xs text-rosa-800 font-bold underline"
        >
          ← Voltar para o Login
        </button>
      </div>
    </section>
  );
}
