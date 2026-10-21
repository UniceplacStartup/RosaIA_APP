import type { RegisterFormValues } from '../types/auth';
import type { ToastType } from '../types/ui';
import { isValidCpf } from './cpfValidator';
import { evaluatePassword, isStrongPassword } from './passwordValidator';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

/** Normaliza espaços repetidos e bordas do nome. */
export function normalizeFullName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/** Exige nome e sobrenome (mín. 2 palavras e 5 caracteres). */
export function isValidFullName(name: string): boolean {
  const normalized = normalizeFullName(name);
  return normalized.split(' ').length >= 2 && normalized.length >= 5;
}

export interface FormFeedback {
  title: string;
  message: string;
  type: ToastType;
}

export type RegistrationValidation =
  | { ok: true; fullName: string; email: string; cpf: string; password: string }
  | { ok: false; feedback: FormFeedback };

/** Valida o cadastro na mesma ordem de regras do protótipo original. */
export function validateRegistration(values: RegisterFormValues): RegistrationValidation {
  const fullName = normalizeFullName(values.fullName);
  const email = values.email.trim();

  if (!isValidFullName(values.fullName)) {
    return {
      ok: false,
      feedback: {
        title: 'Nome Incompleto',
        message: 'Por favor, informe pelo menos seu nome e sobrenome (ex: Maria da Silva).',
        type: 'error',
      },
    };
  }
  if (!isValidEmail(email)) {
    return {
      ok: false,
      feedback: { title: 'E-mail Inválido', message: 'Digite um endereço de e-mail válido.', type: 'error' },
    };
  }
  if (!isValidCpf(values.cpf)) {
    return {
      ok: false,
      feedback: {
        title: 'CPF Inválido',
        message: 'O CPF informado não passou no cálculo dos dígitos verificadores.',
        type: 'error',
      },
    };
  }
  const requirements = evaluatePassword(values.password, values.confirmPassword);
  if (!isStrongPassword(requirements)) {
    return {
      ok: false,
      feedback: {
        title: 'Senha Fora do Padrão',
        message: 'A senha precisa ter 8+ caracteres, maiúscula, minúscula, número e símbolo.',
        type: 'error',
      },
    };
  }
  if (values.password !== values.confirmPassword) {
    return {
      ok: false,
      feedback: {
        title: 'Senhas Diferentes',
        message: 'A confirmação de senha deve ser idêntica à senha.',
        type: 'error',
      },
    };
  }
  if (!values.acceptedTerms) {
    return {
      ok: false,
      feedback: {
        title: 'Termos Obrigatórios',
        message: 'Aceite os Termos de Uso e LGPD para prosseguir.',
        type: 'warning',
      },
    };
  }

  return { ok: true, fullName, email, cpf: values.cpf, password: values.password };
}
