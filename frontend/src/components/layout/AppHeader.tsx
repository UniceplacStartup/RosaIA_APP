import logoRosaia from '../../assets/logo-rosaia.png';
import { useUi } from '../../context/UiContext';
import type { AppTab } from '../../types/ui';

const TABS: ReadonlyArray<{ id: AppTab; label: string }> = [
  { id: 'chat', label: '💬 Chat com a Dra. Rosa' },
  { id: 'triagem', label: '🩺 Triagem & Lembretes' },
  { id: 'sobre', label: '📚 Artigos & Sobre' },
  { id: 'perfil', label: '👤 Meu Perfil' },
];

/** Cabeçalho da aplicação logada com navegação por abas. */
export default function AppHeader() {
  const { activeTab, setActiveTab } = useUi();

  return (
    <header className="bg-rosa-800 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-rosa-900">
      <div className="flex items-center gap-3">
        <img src={logoRosaia} alt="RosaIA" className="w-10 h-10 rounded-full bg-white p-1 object-contain shadow" />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-extrabold text-base sm:text-lg leading-none">RosaIA APP</h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 font-semibold">
              Online • Doutora Rosa
            </span>
          </div>
          <p className="text-[11px] text-rosa-200 mt-0.5">
            Apoio Informativo, Emocional e Análise Educativa de Exames (Sem Imagens)
          </p>
        </div>
      </div>

      <nav
        aria-label="Navegação principal"
        className="flex items-center gap-1 sm:gap-1.5 bg-rosa-900/60 p-1 rounded-full text-xs overflow-x-auto max-w-full"
      >
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              type="button"
              data-tab={tab.id}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => setActiveTab(tab.id)}
              className={
                isActive
                  ? 'app-tab-btn px-3 py-1.5 rounded-full font-bold bg-white text-rosa-800 shadow-sm transition'
                  : 'app-tab-btn px-3 py-1.5 rounded-full font-medium text-rosa-100 hover:bg-white/10 transition'
              }
            >
              {tab.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
