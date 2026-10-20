import type { PasswordRequirements, PasswordRuleItem } from '../types/auth';

/** Checklist OWASP de senha (8+ caracteres, maiúscula, minúscula, número, símbolo e confirmação). */
export function evaluatePassword(password: string, confirmation: string): PasswordRequirements {
  return {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
    matches: password.length > 0 && password === confirmation,
  };
}

/** Senha atende à política de complexidade (exclui a confirmação). */
export function isStrongPassword(req: PasswordRequirements): boolean {
  return req.minLength && req.hasUpper && req.hasLower && req.hasNumber && req.hasSpecial;
}

const RULE_LABELS: ReadonlyArray<readonly [keyof PasswordRequirements, string]> = [
  ['minLength', 'Mín. 8 caracteres'],
  ['hasUpper', '1 letra maiúscula'],
  ['hasLower', '1 letra minúscula'],
  ['hasNumber', '1 número'],
  ['hasSpecial', '1 caractere especial'],
  ['matches', 'Senhas idênticas'],
];

/** Converte o resultado da avaliação em itens renderizáveis. */
export function toRuleItems(req: PasswordRequirements): PasswordRuleItem[] {
  return RULE_LABELS.map(([key, label]) => ({ key, label, satisfied: req[key] }));
}
