import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import { ReminderProvider } from './context/ReminderContext';
import { ToastProvider } from './context/ToastContext';
import { UiProvider, useUi } from './context/UiContext';
import AuthWrapper from './components/auth/AuthWrapper';
import AppShell from './components/layout/AppShell';
import MedicalDisclaimerHeader from './components/layout/MedicalDisclaimerHeader';
import ToastContainer from './components/layout/ToastContainer';
import DeleteAccountModal from './components/modals/DeleteAccountModal';
import GeminiConfigModal from './components/modals/GeminiConfigModal';
import LogoutModal from './components/modals/LogoutModal';

function AppContent() {
  const { isAuthenticated } = useAuth();
  const { isModalOpen, closeModal } = useUi();

  return (
    <>
      {/* Barra permanente de aviso médico e segurança (RNF13 / LGPD / OWASP) */}
      <MedicalDisclaimerHeader />
      <ToastContainer />

      {isAuthenticated ? <AppShell /> : <AuthWrapper />}

      {isModalOpen('gemini') && <GeminiConfigModal onClose={() => closeModal('gemini')} />}
      {isAuthenticated && isModalOpen('logout') && <LogoutModal onClose={() => closeModal('logout')} />}
      {isAuthenticated && isModalOpen('deleteAccount') && (
        <DeleteAccountModal onClose={() => closeModal('deleteAccount')} />
      )}
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <UiProvider>
        <AuthProvider>
          <ReminderProvider>
            <ChatProvider>
              <AppContent />
            </ChatProvider>
          </ReminderProvider>
        </AuthProvider>
      </UiProvider>
    </ToastProvider>
  );
}
