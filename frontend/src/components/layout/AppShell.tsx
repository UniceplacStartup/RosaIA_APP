import { useUi } from '../../context/UiContext';
import AboutSection from '../about/AboutSection';
import ChatSidebar from '../chat/ChatSidebar';
import ChatWindow from '../chat/ChatWindow';
import ProfileSection from '../profile/ProfileSection';
import RemindersSection from '../reminders/RemindersSection';
import TriageSection from '../triage/TriageSection';
import AppHeader from './AppHeader';

/** Casca da aplicação logada: cabeçalho com abas + conteúdo da aba ativa. */
export default function AppShell() {
  const { activeTab } = useUi();

  return (
    <div
      id="appWrapper"
      className="flex-1 flex flex-col max-w-7xl w-full mx-auto my-0 sm:my-3 sm:rounded-3xl overflow-hidden shadow-2xl border border-rosa-200 bg-white"
    >
      <AppHeader />

      {activeTab === 'chat' && (
        <section id="tabContentChat" className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-[620px]">
          <ChatSidebar />
          <ChatWindow />
        </section>
      )}

      {activeTab === 'triagem' && (
        <section id="tabContentTriagem" className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 bg-rosa-50/40">
          <TriageSection />
          <RemindersSection />
        </section>
      )}

      {activeTab === 'sobre' && <AboutSection />}
      {activeTab === 'perfil' && <ProfileSection />}
    </div>
  );
}
