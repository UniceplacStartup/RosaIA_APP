import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthView, User } from '../types/auth';
import { DEMO_USER, DEMO_PASSWORD } from '../data/seedData';
import { onlyDigits } from '../utils/cpfValidator';
import { maskCpfLgpd, simulateBlindIndex } from '../utils/cryptoSimulation';
import { isValidEmail } from '../utils/formValidators';
import { clearAllStorage, clearUserSessionStorage, safeGetStorage, safeSetStorage, STORAGE_KEYS } from '../utils/storage';
import { api, ApiError, clearStoredToken, getStoredToken } from '../services/api';
import { useToast } from './ToastContext';

export interface RegisterPayload {
  fullName: string;
  email: string;
  cpf: string;
  password?: string;
  confirmPassword?: string;
  acceptedTerms?: boolean;
}

export interface ResetPasswordWithCodeInput {
  identifier: string;
  recoveryCode: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ResetPasswordWithCodeResult {
  ok: boolean;
  newRecoveryCode?: string;
  error?: string;
}

export interface GenerateRecoveryCodeResult {
  ok: boolean;
  code?: string;
  error?: string;
}

interface AuthContextValue {
  user: User;
  isAuthenticated: boolean;
  authView: AuthView;
  setAuthView: (view: AuthView) => void;
  /** Incrementa a cada exclusão de conta ou logout; outros contextos reagem limpando seus dados. */
  accountResetToken: number;
  /** Código de recuperação recém-gerado no cadastro para exibição única em modal. */
  pendingRecoveryCode: string | null;
  clearPendingRecoveryCode: () => void;
  /** True quando uma conta existente ainda não cadastrou código de recuperação. */
  needsRecoveryCodeSetup: boolean;
  dismissRecoveryCodeSetup: () => void;
  login: (email: string, password: string) => Promise<boolean>;
  loginDemo: () => void;
  register: (payload: RegisterPayload) => Promise<boolean>;
  requestPasswordReset: (email: string) => Promise<boolean>;
  resetPasswordWithCode: (payload: ResetPasswordWithCodeInput) => Promise<ResetPasswordWithCodeResult>;
  generateRecoveryCode: (currentPassword?: string) => Promise<GenerateRecoveryCodeResult>;
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
  
  // Persistência no reload (F5): verifica se há token e perfil salvo no storage
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const token = getStoredToken();
    const savedUser = safeGetStorage<User | null>(STORAGE_KEYS.user, null, isUser);
    return Boolean(token && savedUser);
  });

  const [authView, setAuthView] = useState<AuthView>('welcome');
  const [accountResetToken, setAccountResetToken] = useState(0);
  const [pendingRecoveryCode, setPendingRecoveryCode] = useState<string | null>(null);
  const [needsRecoveryCodeSetup, setNeedsRecoveryCodeSetup] = useState(false);

  const clearPendingRecoveryCode = useCallback(() => {
    setPendingRecoveryCode(null);
  }, []);

  const dismissRecoveryCodeSetup = useCallback(() => {
    setNeedsRecoveryCodeSetup(false);
  }, []);

  const enterApp = useCallback(
    (nextUser: User, welcomeMessage: string) => {
      setUser(nextUser);
      safeSetStorage(STORAGE_KEYS.user, nextUser);
      setIsAuthenticated(true);
      showToast('Acesso Liberado', welcomeMessage, 'success');
    },
    [showToast],
  );

  const logout = useCallback(() => {
    const currentEmail = user?.email;
    clearStoredToken();
    try {
      api.auth.logout();
    } catch {
      /* noop */
    }
    clearUserSessionStorage(currentEmail);
    setUser(DEMO_USER);
    setPendingRecoveryCode(null);
    setNeedsRecoveryCodeSetup(false);
    setAccountResetToken((token) => token + 1);
    setIsAuthenticated(false);
    setAuthView('login');
    showToast('Sessão Encerrada', 'Você saiu da sua conta com segurança.', 'info');
  }, [showToast, user?.email]);

  // Validação assíncrona de sessão no reload (F5) sem desconectar se offline
  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      api.auth
        .getProfile()
        .then((res) => {
          const apiUser = res?.user ?? res;
          if (apiUser && apiUser.email) {
            setUser((prev) => {
              const updated: User = {
                fullName: apiUser.full_name || apiUser.fullName || prev.fullName,
                email: apiUser.email || prev.email,
                cpfMasked: apiUser.cpf_masked || apiUser.cpfMasked || prev.cpfMasked,
                cpfHash: apiUser.cpf_hash || apiUser.cpfHash || prev.cpfHash,
                hasRecoveryCode:
                  typeof apiUser.has_recovery_code === 'boolean'
                    ? apiUser.has_recovery_code
                    : prev.hasRecoveryCode,
              };
              safeSetStorage(STORAGE_KEYS.user, updated);
              return updated;
            });
            setIsAuthenticated(true);
          }
        })
        .catch((err: unknown) => {
          if (err instanceof ApiError && err.status === 401) {
            logout();
          }
        });
    }
  }, [logout]);

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
        const hasRecoveryCode =
          typeof apiUser.has_recovery_code === 'boolean' ? apiUser.has_recovery_code : true;
        const loggedUser: User = {
          fullName: apiUser.full_name || apiUser.fullName || user.fullName,
          email: apiUser.email || cleanIdentifier,
          cpfMasked: apiUser.cpf_masked || apiUser.cpfMasked || '***.***.***-**',
          cpfHash: apiUser.cpf_hash || apiUser.cpfHash || '',
          hasRecoveryCode,
        };

        if (apiUser.needs_recovery_code) {
          setNeedsRecoveryCodeSetup(true);
        }

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
          hasRecoveryCode: true,
        };

        if (response.recovery_code) {
          setPendingRecoveryCode(response.recovery_code);
        }

        enterApp(
          newUser,
          'Cadastro realizado com sucesso! Salve seu código de recuperação.',
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


  const resetPasswordWithCode = useCallback(
    async ({
      identifier,
      recoveryCode,
      newPassword,
      confirmPassword,
    }: ResetPasswordWithCodeInput): Promise<ResetPasswordWithCodeResult> => {
      try {
        const res = await api.auth.resetPasswordWithCode({
          identifier: identifier.trim(),
          recovery_code: recoveryCode.trim(),
          new_password: newPassword,
          confirm_password: confirmPassword,
        });
        showToast('Senha Redefinida', 'Sua senha foi atualizada. Guarde seu novo código de recuperação!', 'success');
        return { ok: true, newRecoveryCode: res.new_recovery_code };
      } catch (err: unknown) {
        const msg =
          err instanceof ApiError
            ? err.message
            : 'Não foi possível redefinir a senha. Verifique os dados informados.';
        showToast('Falha na Redefinição', msg, 'error');
        return { ok: false, error: msg };
      }
    },
    [showToast],
  );

  const generateRecoveryCode = useCallback(
    async (currentPassword?: string): Promise<GenerateRecoveryCodeResult> => {
      try {
        const res = await api.auth.generateRecoveryCode(currentPassword);
        setUser((prev) => {
          const updated: User = { ...prev, hasRecoveryCode: true };
          safeSetStorage(STORAGE_KEYS.user, updated);
          return updated;
        });
        setNeedsRecoveryCodeSetup(false);
        showToast('Código Gerado', 'Salve seu código de recuperação em um local seguro.', 'success');
        return { ok: true, code: res.recovery_code };
      } catch (err: unknown) {
        const msg =
          err instanceof ApiError
            ? err.message
            : 'Não foi possível gerar o código de recuperação no momento.';
        showToast('Erro ao Gerar Código', msg, 'error');
        return { ok: false, error: msg };
      }
    },
    [showToast],
  );


  const deleteAccount = useCallback(
    (confirmation: string): boolean => {
      if (confirmation.trim().toUpperCase() !== DELETE_CONFIRMATION_WORD) {
        showToast('Confirmação Necessária', 'Digite EXCLUIR para confirmar a remoção permanente.', 'warning');
        return false;
      }
      clearStoredToken();
      clearAllStorage();
      setUser(DEMO_USER);
      setPendingRecoveryCode(null);
      setNeedsRecoveryCodeSetup(false);
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
      pendingRecoveryCode,
      clearPendingRecoveryCode,
      needsRecoveryCodeSetup,
      dismissRecoveryCodeSetup,
      login,
      loginDemo,
      register,
      requestPasswordReset,
      resetPasswordWithCode,
      generateRecoveryCode,
      logout,
      deleteAccount,
    }),
    [
      user,
      isAuthenticated,
      authView,
      accountResetToken,
      pendingRecoveryCode,
      clearPendingRecoveryCode,
      needsRecoveryCodeSetup,
      dismissRecoveryCodeSetup,
      login,
      loginDemo,
      register,
      requestPasswordReset,
      resetPasswordWithCode,
      generateRecoveryCode,
      logout,
      deleteAccount,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
