import type { CpfCryptoPreviewData } from '../../types/auth';

interface CpfCryptoPreviewProps {
  preview: CpfCryptoPreviewData;
}

/** Card explicativo do Blind Index (HMAC-SHA256) e da máscara LGPD do CPF, em tempo real. */
export default function CpfCryptoPreview({ preview }: CpfCryptoPreviewProps) {
  return (
    <div
      id="cpfCryptoPreview"
      className="bg-rosa-100/80 border border-rosa-300 rounded-xl p-2.5 text-[11px] space-y-1"
    >
      <div className="flex items-center justify-between font-semibold text-rosa-900">
        <span>🔒 Proteção LGPD no Banco PostgreSQL:</span>
        <div className="flex items-center gap-1.5">
          <span
            id="cpfStatusBadge"
            className={`px-2 py-0.5 rounded text-white text-[10px] ${preview.isValid ? 'bg-emerald-700' : 'bg-red-600'}`}
          >
            {preview.isValid ? 'CPF Válido (Módulo 11)' : 'CPF Inválido'}
          </span>
          {preview.isChecking && (
            <span className="px-2 py-0.5 rounded bg-amber-500 text-white text-[10px] animate-pulse">
              Consultando...
            </span>
          )}
          {preview.isRegistered === true && (
            <span id="cpfRegisteredBadge" className="px-2 py-0.5 rounded bg-rose-700 text-white text-[10px] font-bold">
              Já Cadastrado
            </span>
          )}
          {preview.isRegistered === false && preview.isValid && (
            <span id="cpfAvailableBadge" className="px-2 py-0.5 rounded bg-teal-600 text-white text-[10px]">
              Disponível
            </span>
          )}
        </div>
      </div>
      {preview.isRegistered === true && (
        <div className="p-1.5 rounded bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-medium flex items-center gap-1.5">
          <span>⚠️</span>
          <span>Este CPF já possui cadastro no RosaIA. Por favor, acesse a tela de login.</span>
        </div>
      )}
      <div className="text-gray-700 truncate">
        <strong>Blind Index (cpf_hash):</strong>{' '}
        <code id="cpfHashValue" className="font-mono text-rosa-900">
          {preview.blindIndex}
        </code>
      </div>
      <div className="text-gray-700">
        <strong>Armazenamento (cpf_masked):</strong>{' '}
        <code id="cpfMaskValue" className="font-mono text-rosa-900">
          {preview.masked}
        </code>{' '}
        (AES-256-GCM no servidor)
      </div>
    </div>
  );
}
