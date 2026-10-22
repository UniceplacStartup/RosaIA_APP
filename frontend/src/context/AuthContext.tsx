import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthView, User } from '../types/auth';
import { DEMO_USER, DEMO_PASSWORD } from '../data/seedData';
import { onlyDigits } from '../utils/cpfValidator';
import { maskCpfLgpd, simulateBlindIndex } from '../utils/cryptoSimulation';
import { isValidEmail } from '../utils/formValidators';
import { clearAllStorage, safeGetStorage, safeSetStorage, STORAGE_KEYS } from '../utils/storage';
import { api, ApiError, clearStoredToken } from '../services/api';
import { useToast } from './ToastContext';

export interface RegisterPayload {
  fullName: string;
  email: string;
  cpf: string;
  password?: string;
  confirmPassword?: string;
  acceptedTerms?: boolean;
}

interface AuthContextValue {
  user: User;
  isAuthenticated: boolean;
  authView: AuthView;
  setAuthView: (view: AuthView) => void;
  /** Incrementa a cada exclusão de conta; outros contextos reagem limpando seus dados. */
  accountResetToken: number;
  login: (email: string, password: string) => Promise<boolean>;
  loginDemo: () => void;
  register: (payload: RegisterPayload) => Promise<boolean>;
  requestPasswordReset: (email: string) => Promise<boolean>;
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
    async (identifier: string, password: string): Promise<boolean> => {
      const cleanIdentifier = identifier.trim();
      if (!cleanIdentifier || !password) {
        showToast('Campos Obrigatórios', 'Preencha seu e-mail ou CPF e senha para entrar.', 'warning');
        return false;
      }

      try {
        const response = await api.auth.login({
          identifier: cleanIdentifier,
          password,
        });

        const apiUser = response.user;
        const loggedUser: User = {
          fullName: apiUser.full_name || apiUser.fullName || user.fullName,
          email: apiUser.email || cleanIdentifier,
          cpfMasked: apiUser.cpf_masked || apiUser.cpfMasked || '***.***.***-**',
          cpfHash: apiUser.cpf_hash || apiUser.cpfHash || '',
        };

        enterApp(loggedUser, 'Sessão iniciada com sucesso!');
        return true;
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 0) {
          if (cleanIdentifier.toLowerCase() === DEMO_USER.email.toLowerCase() && password === DEMO_PASSWORD) {
            enterApp(DEMO_USER, 'Bem-vinda! Modo demonstração ativo.');
            return true;
          }
          showToast(
            'Servidor Indisponível',
            'Não foi possível conectar ao servidor de atendimento. Tente novamente em instantes.',
            'error'
          );
          return false;
        }

        const msg =
          err instanceof ApiError
            ? err.message
            : 'Credenciais inválidas ou conta temporariamente bloqueada por segurança.';
        showToast('Falha no Login', msg, 'error');
        return false;
      }
    },
    [enterApp, showToast, user],
  );

  const loginDemo = useCallback(() => {
    enterApp(DEMO_USER, 'Bem-vinda de volta, Maria da Silva! Modo demonstração pronto.');
  }, [enterApp]);

  const register = useCallback(
    async ({
      fullName,
      email,
      cpf,
      password,
      confirmPassword,
      acceptedTerms,
    }: RegisterPayload): Promise<boolean> => {
      const cleanCpf = onlyDigits(cpf);

      try {
        const response = await api.auth.register({
          full_name: fullName,
          email: email.trim().toLowerCase(),
          cpf: cleanCpf,
          password: password || 'SenhaSegura@2026',
          confirm_password: confirmPassword || password || 'SenhaSegura@2026',
          accepted_terms: acceptedTerms !== false,
        });

        const apiUser = response.user;
        const newUser: User = {
          fullName: apiUser.full_name || apiUser.fullName || fullName,
          email: apiUser.email || email,
          cpfMasked: apiUser.cpf_masked || apiUser.cpfMasked || maskCpfLgpd(cleanCpf),
          cpfHash: apiUser.cpf_hash || apiUser.cpfHash || simulateBlindIndex(cleanCpf),
        };

        enterApp(
          newUser,
          'Cadastro realizado com sucesso! Seja bem-vinda ao RosaIA.',
        );
        return true;
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 0) {
          showToast(
            'Servidor Indisponível',
            'Não foi possível conectar ao servidor no momento. Verifique sua conexão e tente novamente.',
            'error'
          );
          return false;
        }

        const msg = err instanceof ApiError ? err.message : 'Não foi possível completar o cadastro.';
        showToast('Erro no Cadastro', msg, 'error');
        return false;
      }
    },
    [enterApp, showToast],
  );

  /** OWASP A07: resposta idêntica exista ou não a conta (anti-enumeração). */
  const requestPasswordReset = useCallback(
    async (email: string): Promise<boolean> => {
      const clean = email.trim();
      if (!clean || !isValidEmail(clean)) {
        showToast('E-mail Obrigatório', 'Informe um endereço de e-mail válido.', 'warning');
        return false;
      }

      try {
        await api.auth.recoverPassword(clean);
      } catch {
        // Silencioso ou contingência
      }

      showToast('Solicitação Processada', 'Se o e-mail estiver cadastrado, enviaremos o link de redefinição.', 'success');
      return true;
    },
    [showToast],
  );

  const logout = useCallback(() => {
    api.auth.logout();
    setIsAuthenticated(false);
    setAuthView('login');
    showToast('Sessão Encerrada', 'Você saiu da sua conta com segurança.', 'info');
  }, [showToast]);

  const deleteAccount = useCallback(
    (confirmation: string): boolean => {
      if (confirmation.trim().toUpperCase() !== DELETE_CONFIRMATION_WORD) {
        showToast('Confirmação Necessária', 'Digite EXCLUIR para confirmar a remoção permanente.', 'warning');
        return false;
      }
      clearStoredToken();
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
