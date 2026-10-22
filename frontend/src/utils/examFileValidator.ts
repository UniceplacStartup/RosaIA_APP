import type { ExamValidationResult } from '../types/chat';

/** Formatos autorizados: Laudos textuais, documentos e exames de imagem (DICOM e convencionais). */
const ALLOWED_EXTENSIONS_REGEX =
  /\.(pdf|txt|doc|docx|dcm|dicom|jpg|jpeg|png|webp|bmp|tif|tiff)$/i;

export const ALLOWED_DOCUMENT_ACCEPT =
  '.pdf,.txt,.doc,.docx,.dcm,.dicom,.jpg,.jpeg,.png,.webp,.bmp,.tif,.tiff';

export const MAX_EXAM_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

/** Validação síncrona por nome/extensão e tamanho. */
export function validateExamFileMeta(fileName: string, fileSize?: number): ExamValidationResult {
  const name = fileName.toLowerCase();

  if (fileSize && fileSize > MAX_EXAM_FILE_SIZE) {
    return { ok: false, reason: 'file_too_large' };
  }

  if (!ALLOWED_EXTENSIONS_REGEX.test(name)) {
    return { ok: false, reason: 'unsupported_extension' };
  }

  return { ok: true };
}

/** Validação completa assíncrona do arquivo antes do envio. */
export async function validateExamFile(file: File): Promise<ExamValidationResult> {
  return validateExamFileMeta(file.name, file.size);
}
