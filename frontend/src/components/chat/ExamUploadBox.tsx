import { useChat } from '../../context/ChatContext';
import { useExamFileInput } from '../../hooks/useExamFileInput';
import { ALLOWED_DOCUMENT_ACCEPT } from '../../utils/examFileValidator';

/** Card de upload de laudos e imagens médicas (DICOM e convencionais) com sanitização LGPD. */
export default function ExamUploadBox() {
  const { simulateSampleDocument } = useChat();
  const handleFileChange = useExamFileInput();

  return (
    <div className="bg-white rounded-2xl p-3.5 border-2 border-dashed shadow-sm space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-extrabold text-rosa-800">🔬 Enviar Laudo ou Imagem de Exame</span>
        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-700 text-white font-bold">LGPD Seguro</span>
      </div>
      <p className="text-[11px] text-gray-600 leading-snug">
        Envie laudos em <strong>PDF, TXT ou DOCX</strong> e imagens médicas (<strong>DICOM .dcm, JPG, PNG</strong>).
        A Doutora Rosa higieniza dados pessoais automaticamente e analisa os aspectos descritivos do exame.
      </p>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="inputExameUpload"
          className="cursor-pointer w-full py-2 px-3 rounded-xl bg-rosa-800 hover:bg-rosa-900 text-white font-bold text-xs text-center shadow transition"
        >
          📎 Selecionar Laudo ou Imagem (PDF / DICOM / Imagem)
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
        <div className="text-[11px] font-semibold text-gray-700">Testar Análise de Exames em 1 clique:</div>
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
            id="btnSampleDicom"
            type="button"
            data-sample-doc="dicom_sample"
            onClick={() => simulateSampleDocument('dicom_sample')}
            className="sample-doc-btn text-[11px] px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-300 font-semibold text-left transition"
          >
            🔬 Simular Imagem Médica DICOM (Mamografia Digital Desidentificada)
          </button>
        </div>
      </div>
    </div>
  );
}
