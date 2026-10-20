import { useChat } from '../../context/ChatContext';
import { useExamFileInput } from '../../hooks/useExamFileInput';
import { ALLOWED_DOCUMENT_ACCEPT } from '../../utils/examFileValidator';

/** Card de upload de laudos (PDF/TXT/DOCX) com bloqueio estrito de imagens (LGPD) e testes em 1 clique. */
export default function ExamUploadBox() {
  const { simulateSampleDocument } = useChat();
  const handleFileChange = useExamFileInput();

  return (
    // A cor da borda segue o padrão do protótipo (a classe `border-rosa-400` nunca existiu na paleta).
    <div className="bg-white rounded-2xl p-3.5 border-2 border-dashed shadow-sm space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-extrabold text-rosa-800">📄 Enviar Exame / Documento (Sem Imagem)</span>
        <span className="text-[10px] px-2 py-0.5 rounded bg-rosa-800 text-white font-bold">LGPD Strict</span>
      </div>
      <p className="text-[11px] text-gray-600 leading-snug">
        Envie laudos em <strong>.PDF, .TXT ou .DOCX</strong>. A IA remove seu CPF/nome automaticamente e explica o
        resultado em linguagem simples. <strong>Imagens (.jpg, .png, .dicom) são bloqueadas.</strong>
      </p>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="inputExameUpload"
          className="cursor-pointer w-full py-2 px-3 rounded-xl bg-rosa-800 hover:bg-rosa-900 text-white font-bold text-xs text-center shadow transition"
        >
          📎 Selecionar Documento (.PDF / .TXT / .DOCX)
        </label>
        <input
          id="inputExameUpload"
          type="file"
          accept={ALLOWED_DOCUMENT_ACCEPT}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      <div className="pt-1 border-t border-rosa-100 space-y-1.5">
        <div className="text-[11px] font-semibold text-gray-700">Testar Análise de Laudos / Bloqueio LGPD em 1 clique:</div>
        <div className="grid grid-cols-1 gap-1.5">
          <button
            id="btnSampleBirads2"
            type="button"
            data-sample-doc="birads2"
            onClick={() => simulateSampleDocument('birads2')}
            className="sample-doc-btn text-[11px] px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-medium text-left transition"
          >
            📄 Simular Laudo Mamografia BI-RADS 2 (Achado Benigno)
          </button>
          <button
            id="btnSampleBirads3"
            type="button"
            data-sample-doc="birads3"
            onClick={() => simulateSampleDocument('birads3')}
            className="sample-doc-btn text-[11px] px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-medium text-left transition"
          >
            📄 Simular Ultrassom Mamário BI-RADS 3 (Provavelmente Benigno)
          </button>
          <button
            id="btnSampleImageBlocked"
            type="button"
            data-sample-doc="image_blocked"
            onClick={() => simulateSampleDocument('image_blocked')}
            className="sample-doc-btn text-[11px] px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-900 border border-red-300 font-semibold text-left transition"
          >
            🚫 Testar Tentativa de Envio de Foto `mamografia_foto.jpg` (Bloqueio LGPD)
          </button>
        </div>
      </div>
    </div>
  );
}
