import { onlyDigits } from './cpfValidator';

/**
 * Simulação determinística de Blind Index (HMAC-SHA256) para exibição educativa.
 * Em produção, o hash é calculado exclusivamente no servidor com chave secreta (pepper).
 */
export function simulateBlindIndex(cleanCpf: string): string {
  let h1 = 0xdeadbeef ^ cleanCpf.length;
  let h2 = 0x41c6ce57 ^ cleanCpf.length;
  for (let i = 0; i < cleanCpf.length; i++) {
    const ch = cleanCpf.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex = (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
  return (hex + hex + hex + hex).slice(0, 64);
}

/** Máscara LGPD do CPF: `***.xxx.xxx-**`. CPF incompleto retorna máscara total. */
export function maskCpfLgpd(cpf: string): string {
  const clean = onlyDigits(cpf);
  if (clean.length !== 11) return '***.***.***-**';
  return '***.'.concat(clean.slice(3, 6), '.', clean.slice(6, 9), '-**');
}
