import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DEMO_PASSWORD, DEMO_USER } from '../../data/seedData';
import { AUTH_INPUT_LARGE_CLASS, AUTH_LABEL_CLASS } from './formStyles';

/** Tela 04 — Login por e-mail e senha (RF04), com conta de teste de Maria da Silva. */
export default function LoginView() {
  const { login, loginDemo, setAuthView } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    login(email, password);
  };

  const handleDemo = () => {
    setEmail(DEMO_USER.email);
    setPassword(DEMO_PASSWORD);
    loginDemo();
  };

  return (
    <section id="authViewLogin" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold text-rosa-800">Acessar Conta</h2>
        <button
          id="btnBackToWelcome2"
          type="button"
          onClick={() => setAuthView('welcome')}
          className="text-xs text-rosa-700 hover:underline font-medium"
        >
          ← Início
        </button>
      </div>
      <p className="text-xs text-gray-600">
        Entre com seu e-mail e senha para continuar sua conversa com a Doutora Rosa.
      </p>

      <form id="formLogin" className="space-y-3.5" noValidate onSubmit={handleSubmit}>
        <div>
          <label htmlFor="loginEmail" className={AUTH_LABEL_CLASS}>
            E-mail <span className="text-red-600">*</span>
          </label>
          <input
            id="loginEmail"
            type="email"
            autoComplete="username"
            placeholder="maria.silva@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={AUTH_INPUT_LARGE_CLASS}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="loginSenha" className="block text-xs font-semibold text-rosa-900">
              Senha <span className="text-red-600">*</span>
            </label>
            <button
              id="btnToggleLoginSenha"
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="text-[11px] text-rosa-700 font-medium"
            >
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          <input
            id="loginSenha"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Digite sua senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={AUTH_INPUT_LARGE_CLASS}
          />
        </div>

        <div className="flex items-center justify-between text-xs">
          <label className="inline-flex items-center gap-2 text-gray-700 cursor-pointer">
            <input type="checkbox" defaultChecked className="accent-rosa-800 rounded" />
            <span>Lembrar meu acesso com segurança</span>
          </label>
          <button
            id="btnGoRecuperarSenha"
            type="button"
            onClick={() => setAuthView('reset')}
            className="text-rosa-800 font-bold hover:underline"
          >
            Esqueci minha senha
          </button>
        </div>

        <button
          id="btnSubmitLogin"
          type="submit"
          className="w-full py-3 rounded-full bg-rosa-800 hover:bg-rosa-900 text-white font-bold text-sm shadow-md transition"
        >
          Entrar no Chat da Doutora Rosa
        </button>
      </form>

      <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2">
        <div className="text-xs text-emerald-900">
          <strong>Conta de Teste Pronta:</strong> Maria da Silva (conversa iniciada em{' '}
          <code className="font-bold">02/09</code>)
        </div>
        <button
          id="btnQuickDemoLogin"
          type="button"
          onClick={handleDemo}
          className="px-3 py-1.5 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shrink-0 transition"
        >
          Preencher &amp; Entrar
        </button>
      </div>

      <div className="text-center text-xs text-gray-700">
        Não possui uma conta?{' '}
        <button
          id="btnSwitchToCadastro"
          type="button"
          onClick={() => setAuthView('register')}
          className="text-rosa-800 font-bold underline"
        >
          Criar conta
        </button>
      </div>
    </section>
  );
}
