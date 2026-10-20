import { useAuth } from '../../context/AuthContext';
import { useUi } from '../../context/UiContext';
import { ShieldCheckIcon } from '../common/icons';

/** Barra superior permanente de aviso médico (RNF13) + selo OWASP/LGPD. */
export default function MedicalDisclaimerHeader() {
  const { isAuthenticated, loginDemo } = useAuth();
  const { openModal, setActiveTab } = useUi();

  const handleOpenArchitecture = () => {
    if (!isAuthenticated) loginDemo();
    setActiveTab('arquitetura');
  };

  return (
    <div
      role="note"
      className="bg-rosa-900 text-rosa-100 text-xs py-2 px-3 sm:px-6 flex flex-wrap items-center justify-between gap-2 border-b border-rosa-700 z-30"
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rosa-500 text-white">
          Aviso Médico (RNF13)
        </span>
        <span>
          A <strong>Doutora Rosa (IA)</strong> oferece apoio informativo e emocional, mas{' '}
          <strong>não realiza diagnósticos nem substitui médicos</strong>.
        </span>
      </div>
      <div className="flex items-center gap-3 text-[11px]">
        <span className="inline-flex items-center gap-1 text-emerald-300 font-medium">
          <ShieldCheckIcon className="w-3.5 h-3.5" />
          OWASP Top 10 &amp; LGPD Ativos (Imagens Bloqueadas)
        </span>
        <button
          id="btnTopConfigIA"
          type="button"
          onClick={() => openModal('gemini')}
          className="underline hover:text-white font-semibold"
        >
          Configurar IA (Gemini)
        </button>
        <button
          id="btnTopArquitetura"
          type="button"
          onClick={handleOpenArchitecture}
          className="bg-white/15 hover:bg-white/25 text-white px-2.5 py-0.5 rounded transition"
        >
          Ver SQL &amp; Plano 10 Dias
        </button>
      </div>
    </div>
  );
}
