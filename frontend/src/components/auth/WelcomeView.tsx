import { useAuth } from '../../context/AuthContext';
import { InfoCircleIcon } from '../common/icons';

/** Tela 01/02 — Boas-vindas e Onboarding (RF01/RF02). */
export default function WelcomeView() {
  const { setAuthView, loginDemo } = useAuth();

  return (
    <section id="authViewBoasVindas" className="space-y-5">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rosa-100 text-rosa-800 text-xs font-semibold">
        <span>🌸 Bem-vinda ao Protótipo Funcional Web (iOS &amp; Android)</span>
      </div>
      <h2 className="text-2xl sm:text-3xl font-extrabold text-rosa-800 leading-tight">
        Olá! Eu sou a Doutora Rosa, sua assistente virtual de saúde mamária.
      </h2>
      <p className="text-sm text-gray-700 leading-relaxed">
        Estou aqui para conversar com você como no WhatsApp, tirar dúvidas sobre sintomas, acolher seus sentimentos com
        carinho e ajudar você a compreender os termos dos seus exames em texto ou PDF.
      </p>

      <div className="bg-white rounded-2xl p-4 border border-rosa-200 shadow-sm space-y-2 text-xs text-gray-700">
        <div className="font-bold text-rosa-800 flex items-center gap-1.5">
          <InfoCircleIcon className="w-4 h-4 text-rosa-600" />
          Importante antes de começar (RF02 / RF05):
        </div>
        <ul className="list-disc list-inside space-y-1 text-gray-600">
          <li>
            A Doutora Rosa é uma inteligência artificial educativa e <strong>não realiza diagnósticos médicos</strong>.
          </li>
          <li>Não substituímos consultas médicas, psicólogos ou atendimentos de emergência.</li>
          <li>
            Por respeito à <strong>LGPD</strong>, fotos ou imagens das mamas/exames são bloqueadas; aceitamos apenas
            documentos/laudos em PDF ou texto.
          </li>
        </ul>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        <button
          id="btnGoLoginFromWelcome"
          type="button"
          onClick={() => setAuthView('login')}
          className="w-full py-3 px-4 rounded-full bg-rosa-800 hover:bg-rosa-900 text-white font-bold text-sm shadow-md transition"
        >
          Entrar na minha conta
        </button>
        <button
          id="btnGoCadastroFromWelcome"
          type="button"
          onClick={() => setAuthView('register')}
          className="w-full py-3 px-4 rounded-full bg-white hover:bg-rosa-100 text-rosa-800 border-2 border-rosa-800 font-bold text-sm transition"
        >
          Criar nova conta (CPF + OWASP)
        </button>
      </div>

      <div className="pt-2 border-t border-rosa-200 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span className="text-xs text-gray-600">Precisa testar o chat e os laudos agora mesmo?</span>
        <button
          id="btnQuickDemoWelcome"
          type="button"
          onClick={loginDemo}
          className="w-full sm:w-auto text-xs font-bold px-4 py-2 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white shadow transition"
        >
          ⚡ Entrar com Conta Demo (Histórico 02/09)
        </button>
      </div>
    </section>
  );
}
