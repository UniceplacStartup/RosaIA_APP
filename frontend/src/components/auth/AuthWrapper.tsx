import { useAuth } from '../../context/AuthContext';
import { useRegisterForm } from '../../hooks/useRegisterForm';
import { useToast } from '../../context/ToastContext';
import { useState } from 'react';
import logoRosaia from '../../assets/logo-rosaia.png';
import logoUniceplac from '../../assets/logo-uniceplac.png';
import TermsModal from '../modals/TermsModal';
import LoginView from './LoginView';
import PasswordResetView from './PasswordResetView';
import RegisterView from './RegisterView';
import WelcomeView from './WelcomeView';

const SECURITY_PILLARS: ReadonlyArray<{ title: string; text: string }> = [
  {
    title: 'Apoio Psicológico Embasado:',
    text: 'Mensagens empáticas reforçando que o câncer de mama tem tratamento e altas taxas de cura.',
  },
  {
    title: 'Padrão OWASP Top 10:',
    text: 'Senha forte, proteção contra força bruta, CPF com Blind Index SHA-256 + AES-256.',
  },
  {
    title: 'Proteção LGPD de Exames:',
    text: 'Imagens médicas são estritamente proibidas; apenas laudos em PDF/texto anonimizados são analisados.',
  },
];

/** Container da autenticação: painel institucional esquerdo + telas dinâmicas à direita. */
export default function AuthWrapper() {
  const { authView } = useAuth();
  const { showToast } = useToast();
  const registerForm = useRegisterForm();
  const [isTermsOpen, setIsTermsOpen] = useState(false);

  const handleAcceptTerms = () => {
    registerForm.setAcceptedTerms(true);
    setIsTermsOpen(false);
    showToast('Termos Aceitos', 'Você concordou com os Termos de Uso e Política de Privacidade.', 'success');
  };

  return (
    <main
      id="authWrapper"
      className="flex-1 flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-rosa-800 via-rosa-600 to-rosa-100"
    >
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 bg-white/95 backdrop-blur rounded-3xl shadow-2xl overflow-hidden border border-rosa-200">
        {/* Painel Institucional Esquerdo (Identidade Visual RosaIA + UNICEPLAC) */}
        <div className="lg:col-span-5 bg-gradient-to-b from-rosa-800 via-rosa-700 to-rosa-900 text-white p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img
                src={logoRosaia}
                alt="Logo RosaIA"
                className="w-16 h-16 object-contain bg-white/95 rounded-2xl p-1.5 shadow-md"
              />
              <div>
                <span className="text-xs uppercase tracking-widest text-rosa-200 font-semibold">
                  Projeto de Extensão &amp; Pesquisa
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">RosaIA APP</h1>
                <p className="text-xs text-rosa-100">Assistente Virtual Doutora Rosa</p>
              </div>
            </div>

            <p className="text-sm text-rosa-100 leading-relaxed mb-5">
              Evolução web multiplataforma (iOS, Android e Desktop) do chatbot premiado no{' '}
              <strong>Congresso Nacional de Radiologia</strong>. Acolhimento psicológico humanizado, educação em saúde
              mamária e análise educativa de laudos em texto/PDF.
            </p>

            <div className="space-y-2.5 text-xs bg-black/20 rounded-2xl p-4 border border-white/10">
              <div className="font-bold text-rosa-200 uppercase tracking-wider mb-1">Pilares de Segurança &amp; Cuidado</div>
              {SECURITY_PILLARS.map((pillar) => (
                <div key={pillar.title} className="flex items-start gap-2">
                  <span className="text-emerald-300 font-bold">✓</span>
                  <span>
                    <strong>{pillar.title}</strong> {pillar.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/15 flex items-center justify-between gap-3">
            <div className="bg-white rounded-xl px-3 py-1.5 shadow-sm">
              <img src={logoUniceplac} alt="Logo UNICEPLAC" className="h-9 object-contain" />
            </div>
            <div className="text-right text-[11px] text-rosa-100">
              <div>Radiologia, ADS &amp; Eng. de Software</div>
              <div className="font-semibold text-white">Brasília / Gama — DF</div>
            </div>
          </div>
        </div>

        {/* Painel Direito: Telas Dinâmicas de Auth */}
        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-center bg-rosa-50/60">
          {authView === 'welcome' && <WelcomeView />}
          {authView === 'register' && (
            <RegisterView form={registerForm} onOpenTerms={() => setIsTermsOpen(true)} />
          )}
          {authView === 'login' && <LoginView />}
          {authView === 'reset' && <PasswordResetView />}
        </div>
      </div>

      {isTermsOpen && <TermsModal onClose={() => setIsTermsOpen(false)} onAccept={handleAcceptTerms} />}
    </main>
  );
}
