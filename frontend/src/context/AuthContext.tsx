import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthView, User } from '../types/auth';
import { DEMO_USER } from '../data/seedData';
import { onlyDigits } from '../utils/cpfValidator';
import { maskCpfLgpd, simulateBlindIndex } from '../utils/cryptoSimulation';
import { isValidEmail } from '../utils/formValidators';
import { clearAllStorage, safeGetStorage, safeSetStorage, STORAGE_KEYS } from '../utils/storage';
import { useToast } from './ToastContext';

interface RegisterPayload {
  fullName: string;
  email: string;
  cpf: string;
}

interface AuthContextValue {
  user: User;
  isAuthenticated: boolean;
  authView: AuthView;
  setAuthView: (view: AuthView) => void;
  /** Incrementa a cada exclusão de conta; outros contextos reagem limpando seus dados. */
  accountResetToken: number;
  login: (email: string, password: string) => boolean;
  loginDemo: () => void;
  register: (payload: RegisterPayload) => void;
  requestPasswordReset: (email: string) => boolean;
  logout: () => void;
  deleteAccount: (confirmation: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function isUser(value: unknown): value is User {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.fullName === 'string' &&
    typeof candidate.email === 'string' &&
    typeof candidate.cpfMasked === 'string' &&
    typeof candidate.cpfHash === 'string'
  );
}

export const DELETE_CONFIRMATION_WORD = 'EXCLUIR';

export function AuthProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const [user, setUser] = useState<User>(() => safeGetStorage<User>(STORAGE_KEYS.user, DEMO_USER, isUser));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authView, setAuthView] = useState<AuthView>('welcome');
  const [accountResetToken, setAccountResetToken] = useState(0);

  const enterApp = useCallback(
    (nextUser: User, welcomeMessage: string) => {
      setUser(nextUser);
      safeSetStorage(STORAGE_KEYS.user, nextUser);
      setIsAuthenticated(true);
      showToast('Acesso Liberado', welcomeMessage, 'success');
    },
    [showToast],
  );

  const login = useCallback(
    (email: string, password: string): boolean => {
      const cleanEmail = email.trim();
      if (!cleanEmail || !password) {
        showToast('Campos Obrigatórios', 'Preencha seu e-mail e senha para entrar.', 'warning');
        return false;
      }
      enterApp({ ...user, email: cleanEmail }, 'Sessão autenticada com sucesso! Histórico recorrente desde 02/09 carregado.');
      return true;
    },
    [enterApp, showToast, user],
  );

  const loginDemo = useCallback(() => {
    enterApp(DEMO_USER, 'Bem-vinda de volta, Maria da Silva! Seu histórico desde 02/09 está pronto.');
  }, [enterApp]);

  const register = useCallback(
    ({ fullName, email, cpf }: RegisterPayload) => {
      const newUser: User = {
        fullName,
        email,
        cpfMasked: maskCpfLgpd(cpf),
        cpfHash: simulateBlindIndex(onlyDigits(cpf)),
      };
      enterApp(newUser, 'Cadastro realizado com segurança! CPF protegido com Blind Index SHA-256 e senha criptografada.');
    },
    [enterApp],
  );

  /** OWASP A07: resposta idêntica exista ou não a conta (anti-enumeração). */
  const requestPasswordReset = useCallback(
    (email: string): boolean => {
      const clean = email.trim();
      if (!clean || !isValidEmail(clean)) {
        showToast('E-mail Obrigatório', 'Informe um endereço de e-mail válido.', 'warning');
        return false;
      }
      showToast('Solicitação Processada (RF05)', 'Se o e-mail estiver cadastrado, enviaremos o link de redefinição.', 'success');
      return true;
    },
    [showToast],
  );

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setAuthView('login');
    showToast('Sessão Encerrada (RF12)', 'Você saiu da sua conta com segurança.', 'info');
  }, [showToast]);

  const deleteAccount = useCallback(
    (confirmation: string): boolean => {
      if (confirmation.trim().toUpperCase() !== DELETE_CONFIRMATION_WORD) {
        showToast('Confirmação Necessária', 'Digite EXCLUIR para confirmar a remoção permanente.', 'warning');
        return false;
      }
      clearAllStorage();
      setUser(DEMO_USER);
      setAccountResetToken((token) => token + 1);
      setIsAuthenticated(false);
      setAuthView('welcome');
      showToast('Conta Excluída Permanentemente (LGPD Art. 18)', 'Todos os seus dados e histórico foram removidos.', 'success');
      return true;
    },
    [showToast],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated,
      authView,
      setAuthView,
      accountResetToken,
      login,
      loginDemo,
      register,
      requestPasswordReset,
      logout,
      deleteAccount,
    }),
    [user, isAuthenticated, authView, accountResetToken, login, loginDemo, register, requestPasswordReset, logout, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
