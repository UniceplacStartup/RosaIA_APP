import { ShieldCheckIcon } from '../common/icons';

/** Barra superior permanente de aviso médico e segurança. */
export default function MedicalDisclaimerHeader() {

  return (
    <div
      role="note"
      className="bg-rosa-900 text-rosa-100 text-xs py-2 px-3 sm:px-6 flex flex-wrap items-center justify-between gap-2 border-b border-rosa-700 z-30"
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rosa-500 text-white">
          Aviso Médico
        </span>
        <span>
          A <strong>Doutora Rosa (IA)</strong> oferece acolhimento e educação em saúde, mas{' '}
          <strong>não realiza diagnósticos nem substitui consultas médicas</strong>.
        </span>
      </div>
      <div className="flex items-center gap-3 text-[11px]">
        <span className="inline-flex items-center gap-1 text-emerald-300 font-medium">
          <ShieldCheckIcon className="w-3.5 h-3.5" />
          Ambiente Seguro • Conforme LGPD
        </span>
      </div>
    </div>
  );
}
