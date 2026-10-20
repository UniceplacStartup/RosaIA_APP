/** Remove tudo que não for dígito. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** Aplica a máscara `000.000.000-00` progressivamente (máx. 11 dígitos). */
export function formatCpfMask(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

/**
 * Calcula o dígito verificador (Módulo 11) para os `length` primeiros dígitos.
 * Pesos: de `length + 1` até 2.
 */
function computeCheckDigit(digits: number[], length: number): number {
  let sum = 0;
  for (let i = 0; i < length; i++) {
    sum += (digits[i] ?? 0) * (length + 1 - i);
  }
  return ((sum * 10) % 11) % 10;
}

/** Validação matemática real de CPF (Módulo 11), rejeitando sequências repetidas. */
export function isValidCpf(cpf: string): boolean {
  const clean = onlyDigits(cpf);
  if (clean.length !== 11 || /^(\d)\1{10}$/.test(clean)) return false;

  const digits = clean.split('').map(Number);
  for (let length = 9; length < 11; length++) {
    if (digits[length] !== computeCheckDigit(digits, length)) return false;
  }
  return true;
}

/** Gera um CPF matematicamente válido (formatado) para testes. */
export function generateValidTestCpf(): string {
  let candidate: number[];
  do {
    candidate = Array.from({ length: 9 }, () => Math.floor(Math.random() * 9));
  } while (candidate.every((d) => d === candidate[0]));

  for (let length = 9; length < 11; length++) {
    candidate.push(computeCheckDigit(candidate, length));
  }
  return formatCpfMask(candidate.join(''));
}
