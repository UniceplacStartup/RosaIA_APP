/** Usuária autenticada (CPF nunca é armazenado em texto puro). */
export interface User {
  fullName: string;
  email: string;
  /** CPF mascarado LGPD, ex.: `***.456.789-**` */
  cpfMasked: string;
  /** Blind Index (HMAC-SHA256 simulado) do CPF */
  cpfHash: string;
}

export interface Credentials {
  email: string;
  password: string;
}

/** Telas dinâmicas do fluxo de autenticação. */
export type AuthView = 'welcome' | 'register' | 'login' | 'reset';

/** Dados brutos do formulário de cadastro. */
export interface RegisterFormValues {
  fullName: string;
  email: string;
  cpf: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
}

/** Resultado do checklist OWASP de senha. */
export interface PasswordRequirements {
  minLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  matches: boolean;
}

export interface PasswordRuleItem {
  key: keyof PasswordRequirements;
  label: string;
  satisfied: boolean;
}

/** Pré-visualização criptográfica do CPF (Blind Index + máscara LGPD). */
export interface CpfCryptoPreviewData {
  isValid: boolean;
  blindIndex: string;
  masked: string;
}
