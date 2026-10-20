import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { CpfCryptoPreviewData, PasswordRequirements, RegisterFormValues } from '../types/auth';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { formatCpfMask, generateValidTestCpf, isValidCpf, onlyDigits } from '../utils/cpfValidator';
import { maskCpfLgpd, simulateBlindIndex } from '../utils/cryptoSimulation';
import { validateRegistration } from '../utils/formValidators';
import { evaluatePassword } from '../utils/passwordValidator';

const INITIAL_VALUES: RegisterFormValues = {
  fullName: '',
  email: '',
  cpf: '',
  password: '',
  confirmPassword: '',
  acceptedTerms: false,
};

export interface RegisterFormController {
  values: RegisterFormValues;
  showPasswords: boolean;
  requirements: PasswordRequirements;
  /** `null` enquanto o campo CPF está vazio (preview oculto). */
  cpfPreview: CpfCryptoPreviewData | null;
  canSubmit: boolean;
  setField: (field: 'fullName' | 'email' | 'password' | 'confirmPassword', value: string) => void;
  setCpf: (value: string) => void;
  generateTestCpf: () => void;
  togglePasswordVisibility: () => void;
  setAcceptedTerms: (accepted: boolean) => void;
  submit: (event: FormEvent<HTMLFormElement>) => void;
}

/**
 * Controla todo o estado e as regras do formulário de cadastro,
 * mantendo `RegisterView` puramente apresentacional.
 * O estado vive em `AuthWrapper`, preservando os campos ao navegar entre telas.
 */
export function useRegisterForm(): RegisterFormController {
  const { register } = useAuth();
  const { showToast } = useToast();
  const [values, setValues] = useState<RegisterFormValues>(INITIAL_VALUES);
  const [showPasswords, setShowPasswords] = useState(false);
  const [cpfStatus, setCpfStatus] = useState<{
    checkedDigits: string;
    isRegistered: boolean | null;
    isChecking: boolean;
  }>({
    checkedDigits: '',
    isRegistered: null,
    isChecking: false,
  });

  const requirements = useMemo(
    () => evaluatePassword(values.password, values.confirmPassword),
    [values.password, values.confirmPassword],
  );

  useEffect(() => {
    const digits = onlyDigits(values.cpf);
    if (digits.length !== 11 || !isValidCpf(values.cpf)) {
      setCpfStatus({ checkedDigits: '', isRegistered: null, isChecking: false });
      return;
    }

    let isMounted = true;
    setCpfStatus((prev) => ({ ...prev, checkedDigits: digits, isChecking: true }));

    const timer = setTimeout(async () => {
      try {
        const res = await api.auth.checkCpf(digits);
        if (isMounted) {
          setCpfStatus({ checkedDigits: digits, isRegistered: res.exists, isChecking: false });
          if (res.exists) {
            showToast('CPF Já Cadastrado', 'Já existe uma conta com este CPF. Acesse a tela de login.', 'warning');
          }
        }
      } catch {
        if (isMounted) {
          setCpfStatus({ checkedDigits: digits, isRegistered: null, isChecking: false });
        }
      }
    }, 350);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [values.cpf, showToast]);

  const cpfPreview = useMemo<CpfCryptoPreviewData | null>(() => {
    const digits = onlyDigits(values.cpf);
    if (digits.length === 0) return null;
    return {
      isValid: isValidCpf(values.cpf),
      blindIndex: simulateBlindIndex(digits),
      masked: maskCpfLgpd(digits),
      isRegistered: cpfStatus.checkedDigits === digits ? cpfStatus.isRegistered : null,
      isChecking: cpfStatus.checkedDigits === digits ? cpfStatus.isChecking : false,
    };
  }, [values.cpf, cpfStatus]);

  const setField = useCallback<RegisterFormController['setField']>((field, value) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const setCpf = useCallback((value: string) => {
    setValues((prev) => ({ ...prev, cpf: formatCpfMask(value) }));
  }, []);

  const generateTestCpf = useCallback(() => {
    setValues((prev) => ({ ...prev, cpf: generateValidTestCpf() }));
    showToast('CPF de Teste Gerado', 'Dígitos verificadores calculados pelo algoritmo oficial Módulo 11.', 'info');
  }, [showToast]);

  const togglePasswordVisibility = useCallback(() => setShowPasswords((prev) => !prev), []);

  const setAcceptedTerms = useCallback((accepted: boolean) => {
    setValues((prev) => ({ ...prev, acceptedTerms: accepted }));
  }, []);

  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const result = validateRegistration(values);
      if (!result.ok) {
        const { title, message, type } = result.feedback;
        showToast(title, message, type);
        return;
      }
      if (cpfStatus.isRegistered === true) {
        showToast('CPF Já Cadastrado', 'Este CPF já está cadastrado no sistema. Acesse a tela de login.', 'error');
        return;
      }
      const success = await register({
        fullName: result.fullName,
        email: result.email,
        cpf: result.cpf,
        password: values.password,
        confirmPassword: values.confirmPassword,
        acceptedTerms: values.acceptedTerms,
      });
      if (success) {
        setValues(INITIAL_VALUES);
        setShowPasswords(false);
      }
    },
    [register, showToast, values, cpfStatus.isRegistered],
  );

  return {
    values,
    showPasswords,
    requirements,
    cpfPreview,
    canSubmit: values.acceptedTerms && cpfStatus.isRegistered !== true && !cpfStatus.isChecking,
    setField,
    setCpf,
    generateTestCpf,
    togglePasswordVisibility,
    setAcceptedTerms,
    submit,
  };
}
