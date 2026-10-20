import ModalShell from './ModalShell';

interface TermsModalProps {
  onClose: () => void;
  onAccept: () => void;
}

/** Modal de Termos de Uso, Política LGPD e Isenção Médica (RF06). */
export default function TermsModal({ onClose, onAccept }: TermsModalProps) {
  return (
    <ModalShell
      id="modalTermos"
      titleId="termsModalTitle"
      onClose={onClose}
      panelClassName="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-rosa-200 space-y-4 max-h-[85vh] flex flex-col"
    >
      <div className="flex items-center justify-between border-b border-rosa-100 pb-3">
        <h3 id="termsModalTitle" className="text-lg font-extrabold text-rosa-800">
          Termos de Uso &amp; Aviso Médico (RF06 / LGPD)
        </h3>
        <button
          id="btnCloseTermosModal"
          type="button"
          aria-label="Fechar"
          onClick={onClose}
          className="text-gray-500 hover:text-gray-800 font-bold text-sm"
        >
          ✕
        </button>
      </div>
      <div className="overflow-y-auto custom-scroll text-xs text-gray-700 space-y-3 pr-1">
        <p>
          <strong>1. Propósito Educativo e de Acolhimento:</strong> A Doutora Rosa é uma inteligência artificial criada
          pelo Projeto RosaIA (UNICEPLAC) para oferecer orientações gerais e suporte emocional sobre saúde mamária.
        </p>
        <p>
          <strong>2. O que o RosaIA NÃO faz:</strong>
        </p>
        <ul className="list-disc list-inside space-y-1 text-rosa-900 font-medium">
          <li>Não realiza diagnósticos médicos definitivos;</li>
          <li>Não substitui médicos mastologistas, ginecologistas, radiologistas ou psicólogos;</li>
          <li>Não substitui atendimento de emergência;</li>
          <li>Não realiza consultas nem prescreve medicamentos ou tratamentos.</li>
        </ul>
        <p>
          <strong>3. Proibição Estrita de Imagens e Proteção LGPD (Lei nº 13.709/2018):</strong>
        </p>
        <p>
          Para proteger sua intimidade e seus dados sensíveis de saúde, o envio de fotografias ou imagens de exames é
          bloqueado. O upload de documentos restringe-se a laudos textuais (.PDF, .TXT, .DOCX), cujos dados
          identificadores (CPF, RG, e-mail) são anonimizados automaticamente antes da leitura pela IA.
        </p>
      </div>
      <div className="pt-3 border-t border-rosa-100 flex justify-end gap-2">
        <button
          id="btnAcceptTermosFromModal"
          type="button"
          onClick={onAccept}
          className="w-full py-2.5 rounded-full bg-rosa-800 hover:bg-rosa-900 text-white font-bold text-xs shadow transition"
        >
          Li e Concordo com os Termos de Uso
        </button>
      </div>
    </ModalShell>
  );
}
