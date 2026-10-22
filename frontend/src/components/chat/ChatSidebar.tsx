import { useExamFileInput } from '../../hooks/useExamFileInput';
import { ALLOWED_DOCUMENT_ACCEPT } from '../../utils/examFileValidator';

/**
 * Sidebar lateral esquerda do Chat:
 * Focada exclusivamente no botão de upload de exames e laudos,
 * com especificações detalhadas do que pode e não pode subir para o chat.
 */
export default function ChatSidebar() {
  const handleFileChange = useExamFileInput();

  return (
    <aside className="lg:col-span-4 border-r border-rosa-200 bg-rosa-50/70 p-4 space-y-4 flex flex-col justify-between overflow-y-auto custom-scroll">
      <div className="space-y-4">
        {/* Cabeçalho da Seção de Upload */}
        <div className="bg-white rounded-2xl p-4 border border-rosa-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black uppercase tracking-wider text-rosa-900 flex items-center gap-1.5">
              <span>🔬</span> Central de Upload de Exames
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-700 text-white font-bold tracking-wide">
              LGPD Seguro
            </span>
          </div>

          {/* Área / Botão de Upload com Destaque */}
          <div className="rounded-xl border-2 border-dashed border-rosa-300 hover:border-rosa-500 bg-rosa-50/50 hover:bg-rosa-50 transition p-4 text-center">
            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-rosa-100 text-rosa-800 flex items-center justify-center text-2xl shadow-sm">
              📁
            </div>
            <p className="text-xs font-semibold text-rosa-900 mb-1">
              Envie seu Laudo ou Imagem de Exame
            </p>
            <p className="text-[11px] text-gray-500 mb-3">
              Formatos aceitos: PDF, Imagens (JPG, PNG) e DICOM (.dcm)
            </p>

            <label
              htmlFor="inputExameUpload"
              className="cursor-pointer inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-rosa-800 hover:bg-rosa-900 active:scale-[0.99] text-white font-bold text-xs shadow-md transition"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-4 h-4"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span>Selecionar Arquivo de Exame</span>
            </label>
            <input
              id="inputExameUpload"
              type="file"
              accept={ALLOWED_DOCUMENT_ACCEPT}
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

        {/* Bloco: O que PODE subir */}
        <div className="bg-emerald-50/80 rounded-2xl p-3.5 border border-emerald-200 shadow-sm space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-900">
            <span>✅</span>
            <span>O que você PODE enviar:</span>
          </div>
          <ul className="text-[11px] text-emerald-950 space-y-1.5 leading-snug">
            <li className="flex items-start gap-1.5">
              <span className="font-bold text-emerald-800">•</span>
              <div>
                <strong>Laudos Médicos (PDF, TXT, DOCX):</strong> Laudos descritivos de Mamografia, Ultrassonografia Mamária ou Ressonância.
              </div>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="font-bold text-emerald-800">•</span>
              <div>
                <strong>Imagens de Exames (JPG, PNG, WEBP, TIFF):</strong> Fotografias legíveis do laudo impresso ou das imagens de diagnóstico.
              </div>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="font-bold text-emerald-800">•</span>
              <div>
                <strong>Arquivos Radiológicos DICOM (.dcm):</strong> Imagens de mamografia digital no formato padrão médico desidentificado.
              </div>
            </li>
          </ul>
        </div>

        {/* Bloco: O que NÃO PODE subir */}
        <div className="bg-rose-50/80 rounded-2xl p-3.5 border border-rose-200 shadow-sm space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-rose-900">
            <span>🚫</span>
            <span>O que NÃO PODE enviar:</span>
          </div>
          <ul className="text-[11px] text-rose-950 space-y-1.5 leading-snug">
            <li className="flex items-start gap-1.5">
              <span className="font-bold text-rose-700">•</span>
              <div>
                <strong>Fotos Pessoais ou Íntimas:</strong> Não envie selfies ou fotos corporais sem cunho estritamente técnico de exame.
              </div>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="font-bold text-rose-700">•</span>
              <div>
                <strong>Vídeos, Áudios ou Executáveis:</strong> Formatos como .mp4, .mp3, .exe ou .zip não são aceitos pelo chat.
              </div>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="font-bold text-rose-700">•</span>
              <div>
                <strong>Arquivos Maiores que 15 MB:</strong> O tamanho máximo permitido por arquivo é de 15 MB.
              </div>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="font-bold text-rose-700">•</span>
              <div>
                <strong>Documentos Pessoais Isolados:</strong> Evite enviar RG, CPF avulso, cartões de crédito ou dados financeiros.
              </div>
            </li>
          </ul>
        </div>
      </div>

      {/* Card de Segurança e LGPD */}
      <div className="bg-white/90 rounded-xl p-3 border border-rosa-200 text-[11px] text-gray-600 flex items-start gap-2 shadow-sm">
        <span className="text-base shrink-0">🛡️</span>
        <p className="leading-relaxed">
          <strong className="text-rosa-900">Privacidade Garantida:</strong> Seus dados pessoais passam por higienização e desidentificação automática antes de qualquer análise pela Doutora Rosa.
        </p>
      </div>
    </aside>
  );
}
