import { useAuth } from '../../context/AuthContext';
import type { RegisterFormController } from '../../hooks/useRegisterForm';
import { toRuleItems } from '../../utils/passwordValidator';
import { AUTH_INPUT_CLASS, AUTH_LABEL_CLASS } from './formStyles';
import PasswordRequirementList from './PasswordRequirementList';

interface RegisterViewProps {
  form: RegisterFormController;
  onOpenTerms: () => void;
}

const REQUIRED = <span className="text-red-600">*</span>;

/** Tela 03 — Cadastro seguro de usuária com proteção LGPD. */
export default function RegisterView({ form, onOpenTerms }: RegisterViewProps) {
  const { setAuthView } = useAuth();
  const { values, requirements, showPasswords } = form;
  const passwordType = showPasswords ? 'text' : 'password';

  return (
    <section id="authViewCadastro" className="space-y-3.5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold text-rosa-800">Criar Conta Segura</h2>
        <button
          id="btnBackToWelcome1"
          type="button"
          onClick={() => setAuthView('welcome')}
          className="text-xs text-rosa-700 hover:underline font-medium"
        >
          ← Voltar
        </button>
      </div>
      <p className="text-xs text-gray-600">
        Seus dados são protegidos com total privacidade e sigilo (em conformidade com a LGPD).
      </p>

      <form id="formCadastro" className="space-y-3" noValidate onSubmit={form.submit}>
        <div>
          <label htmlFor="cadNome" className={AUTH_LABEL_CLASS}>
            Nome Completo (Nome e Sobrenome) {REQUIRED}
          </label>
          <input
            id="cadNome"
            type="text"
            autoComplete="name"
            placeholder="Ex: Maria da Silva"
            value={values.fullName}
            onChange={(e) => form.setField('fullName', e.target.value)}
            className={AUTH_INPUT_CLASS}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="cadEmail" className={AUTH_LABEL_CLASS}>
              E-mail {REQUIRED}
            </label>
            <input
              id="cadEmail"
              type="email"
              autoComplete="email"
              placeholder="maria@exemplo.com"
              value={values.email}
              onChange={(e) => form.setField('email', e.target.value)}
              className={AUTH_INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="cadCpf" className="block text-xs font-semibold text-rosa-900 mb-1">
              CPF {REQUIRED}
            </label>
            <input
              id="cadCpf"
              type="text"
              inputMode="numeric"
              maxLength={14}
              placeholder="000.000.000-00"
              value={values.cpf}
              onChange={(e) => form.setCpf(e.target.value)}
              className={`${AUTH_INPUT_CLASS} font-mono`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="cadSenha" className="block text-xs font-semibold text-rosa-900">
                Senha {REQUIRED}
              </label>
              <button
                id="btnToggleCadSenha"
                type="button"
                onClick={form.togglePasswordVisibility}
                className="text-[11px] text-rosa-700 font-medium"
              >
                {showPasswords ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <input
              id="cadSenha"
              type={passwordType}
              autoComplete="new-password"
              placeholder="Ex: Rosa@2026"
              value={values.password}
              onChange={(e) => form.setField('password', e.target.value)}
              className={AUTH_INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="cadConfirmarSenha" className={AUTH_LABEL_CLASS}>
              Confirmar Senha {REQUIRED}
            </label>
            <input
              id="cadConfirmarSenha"
              type={passwordType}
              autoComplete="new-password"
              placeholder="Repita a senha"
              value={values.confirmPassword}
              onChange={(e) => form.setField('confirmPassword', e.target.value)}
              className={AUTH_INPUT_CLASS}
            />
          </div>
        </div>

        <PasswordRequirementList rules={toRuleItems(requirements)} />

        {/* Aceite explícito dos Termos de Uso e LGPD (RF02 / RF06) */}
        <div className="flex items-start gap-2.5 pt-1">
          <input
            id="cadAceiteTermos"
            type="checkbox"
            checked={values.acceptedTerms}
            onChange={(e) => form.setAcceptedTerms(e.target.checked)}
            className="mt-1 w-4 h-4 accent-rosa-800 rounded cursor-pointer"
          />
          <label htmlFor="cadAceiteTermos" className="text-xs text-gray-700 leading-snug">
            Li e concordo explicitamente com os{' '}
            <button
              id="btnOpenTermosModal"
              type="button"
              onClick={onOpenTerms}
              className="text-rosa-800 font-bold underline"
            >
              Termos de Uso, Política de Privacidade (LGPD) e Aviso de Isenção Médica
            </button>
            .
          </label>
        </div>

        <button
          id="btnSubmitCadastro"
          type="submit"
          disabled={!form.canSubmit}
          className="w-full py-3 rounded-full bg-rosa-800 hover:bg-rosa-900 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold text-sm shadow transition"
        >
          Criar Conta e Acessar Doutora Rosa
        </button>
      </form>

      <div className="text-center text-xs text-gray-700 pt-1">
        Já possui uma conta?{' '}
        <button
          id="btnSwitchToLogin"
          type="button"
          onClick={() => setAuthView('login')}
          className="text-rosa-800 font-bold underline"
        >
          Entrar agora
        </button>
      </div>
    </section>
  );
}
