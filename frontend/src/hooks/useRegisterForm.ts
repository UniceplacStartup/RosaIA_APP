import { useCallback, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { CpfCryptoPreviewData, PasswordRequirements, RegisterFormValues } from '../types/auth';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
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

  const requirements = useMemo(
    () => evaluatePassword(values.password, values.confirmPassword),
    [values.password, values.confirmPassword],
  );

  const cpfPreview = useMemo<CpfCryptoPreviewData | null>(() => {
    const digits = onlyDigits(values.cpf);
    if (digits.length === 0) return null;
    return {
      isValid: isValidCpf(values.cpf),
      blindIndex: simulateBlindIndex(digits),
      masked: maskCpfLgpd(digits),
    };
  }, [values.cpf]);

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
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const result = validateRegistration(values);
      if (!result.ok) {
        const { title, message, type } = result.feedback;
        showToast(title, message, type);
        return;
      }
      register({ fullName: result.fullName, email: result.email, cpf: result.cpf });
      setValues(INITIAL_VALUES);
      setShowPasswords(false);
    },
    [register, showToast, values],
  );

  return {
    values,
    showPasswords,
    requirements,
    cpfPreview,
    canSubmit: values.acceptedTerms,
    setField,
    setCpf,
    generateTestCpf,
    togglePasswordVisibility,
    setAcceptedTerms,
    submit,
  };
}
