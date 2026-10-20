import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AUTH_INPUT_LARGE_CLASS, AUTH_LABEL_CLASS } from './formStyles';

/** Tela 05 — Recuperação de senha com proteção contra enumeração de contas (OWASP A07). */
export default function PasswordResetView() {
  const { requestPasswordReset, setAuthView } = useAuth();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (requestPasswordReset(email)) setSubmitted(true);
  };

  return (
    <section id="authViewRecuperar" className="space-y-4">
      <h2 className="text-2xl font-extrabold text-rosa-800">Recuperação de Senha</h2>
      <p className="text-xs text-gray-600 leading-relaxed">
        Informe o e-mail cadastrado. Por segurança (OWASP A07 - Prevenção de Enumeração de Contas), exibimos sempre a
        mensagem padrão.
      </p>

      <form id="formRecuperar" className="space-y-3" noValidate onSubmit={handleSubmit}>
        <div>
          <label htmlFor="recEmail" className={AUTH_LABEL_CLASS}>
            E-mail cadastrado <span className="text-red-600">*</span>
          </label>
          <input
            id="recEmail"
            type="email"
            autoComplete="email"
            placeholder="seuemail@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={AUTH_INPUT_LARGE_CLASS}
          />
        </div>
        <button
          type="submit"
          className="w-full py-3 rounded-full bg-rosa-800 hover:bg-rosa-900 text-white font-bold text-sm shadow transition"
        >
          Enviar Link de Recuperação
        </button>
      </form>

      {submitted && (
        <div
          id="recFeedbackBox"
          role="status"
          className="p-3.5 rounded-2xl bg-rosa-100 border border-rosa-300 text-xs text-rosa-900 font-medium"
        >
          Se o e-mail informado estiver cadastrado, você receberá as instruções para redefinir sua senha.
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
    </section>
  );
}
