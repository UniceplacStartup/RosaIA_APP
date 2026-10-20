import type { ExamValidationResult } from '../types/chat';

/** Extensões de imagem/DICOM — proibidas em qualquer hipótese (LGPD). */
const BLOCKED_IMAGE_EXTENSION =
  /\.(jpg|jpeg|png|gif|webp|bmp|heic|heif|avif|svg|tif|tiff|dcm|dicom)$/;

/** Únicos formatos documentais aceitos (laudos textuais). */
const ALLOWED_DOCUMENT_EXTENSION = /\.(pdf|txt|doc|docx)$/;

export const ALLOWED_DOCUMENT_ACCEPT = '.pdf,.txt,.doc,.docx';

function startsWithBytes(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((value, index) => bytes[offset + index] === value);
}

function asciiAt(bytes: Uint8Array, offset: number, text: string): boolean {
  return startsWithBytes(
    bytes,
    text.split('').map((c) => c.charCodeAt(0)),
    offset,
  );
}

/**
 * Detecta assinatura binária (magic bytes) de imagem, impedindo que uma foto
 * seja enviada apenas renomeada para `.pdf`/`.txt`.
 */
export function hasImageSignature(bytes: Uint8Array): boolean {
  if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) return true; // JPEG
  if (startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return true; // PNG
  if (asciiAt(bytes, 0, 'GIF8')) return true; // GIF
  if (asciiAt(bytes, 0, 'RIFF') && asciiAt(bytes, 8, 'WEBP')) return true; // WEBP
  if (startsWithBytes(bytes, [0x49, 0x49, 0x2a, 0x00]) || startsWithBytes(bytes, [0x4d, 0x4d, 0x00, 0x2a])) {
    return true; // TIFF
  }
  if (asciiAt(bytes, 128, 'DICM')) return true; // DICOM
  if (
    asciiAt(bytes, 4, 'ftyp') &&
    (asciiAt(bytes, 8, 'heic') || asciiAt(bytes, 8, 'heix') || asciiAt(bytes, 8, 'mif1') || asciiAt(bytes, 8, 'avif'))
  ) {
    return true; // HEIC / AVIF
  }
  return false;
}

/** Validação síncrona por MIME e extensão. */
export function validateExamFileMeta(fileName: string, mimeType: string): ExamValidationResult {
  const name = fileName.toLowerCase();
  const type = (mimeType || '').toLowerCase();

  if (type.startsWith('image/') || type === 'application/dicom' || BLOCKED_IMAGE_EXTENSION.test(name)) {
    return { ok: false, reason: 'image_blocked' };
  }
  if (!ALLOWED_DOCUMENT_EXTENSION.test(name)) {
    return { ok: false, reason: 'unsupported_extension' };
  }
  return { ok: true };
}

/** Validação completa: MIME + extensão + assinatura binária (magic bytes). */
export async function validateExamFile(file: File): Promise<ExamValidationResult> {
  const meta = validateExamFileMeta(file.name, file.type);
  if (!meta.ok) return meta;

  try {
    const header = new Uint8Array(await file.slice(0, 140).arrayBuffer());
    if (hasImageSignature(header)) return { ok: false, reason: 'image_blocked' };
  } catch {
    /* leitura indisponível: mantém o resultado da validação por metadados */
  }
  return { ok: true };
}
