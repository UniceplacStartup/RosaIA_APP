import type { ReactNode } from 'react';
import schemaSql from '../../assets/schema.sql?raw';
import { useToast } from '../../context/ToastContext';
import { copyToClipboard } from '../../utils/clipboard';

interface CloudCard {
  eyebrow: string;
  eyebrowClass: string;
  title: string;
  body: ReactNode;
}

const CLOUD_CARDS: ReadonlyArray<CloudCard> = [
  {
    eyebrow: 'Frontend (Gratuito)',
    eyebrowClass: 'text-rosa-600',
    title: 'Vercel Hobby Plan (PWA iOS/Android)',
    body: '100 GB banda/mês, HTTPS automático, compatível com Safari iOS (Adicionar à Tela de Início) sem taxa de US$ 99 da Apple Store.',
  },
  {
    eyebrow: 'Backend + IA (Gratuito)',
    eyebrowClass: 'text-rosa-600',
    title: 'Render Free Web Service + Gemini API',
    body: '750h/mês gratuitas no Render rodando FastAPI (Python) + Google AI Studio (Gemini 3 Flash: 1.500 req/dia grátis + RAG).',
  },
  {
    eyebrow: 'PostgreSQL Gratuito Permanente',
    eyebrowClass: 'text-emerald-700',
    title: 'Neon.tech ou Supabase (Não expira!)',
    body: (
      <>
        O Postgres grátis do Render expira em 30 dias. No <strong>Neon.tech</strong> ou <strong>Supabase</strong>, você
        tem 500 MB permanentes + extensão <code>pgvector</code> grátis!
      </>
    ),
  },
];

/** Cards de nuvem gratuita + visualizador do script DDL PostgreSQL com cópia em 1 clique. */
export default function ArchitectureSection() {
  const { showToast } = useToast();

  const handleCopy = async () => {
    const copied = await copyToClipboard(schemaSql);
    if (copied) {
      showToast('SQL Copiado!', 'O script PostgreSQL + pgvector foi copiado para a área de transferência.', 'success');
    } else {
      showToast('Falha ao Copiar', 'Não foi possível acessar a área de transferência. Selecione o script e copie manualmente.', 'error');
    }
  };

  return (
    <section id="tabContentArquitetura" className="p-6 space-y-6 bg-rosa-50/40">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {CLOUD_CARDS.map((card) => (
          <div key={card.title} className="bg-white p-4 rounded-2xl border border-rosa-200 shadow-sm">
            <div className={`text-xs font-bold uppercase ${card.eyebrowClass}`}>{card.eyebrow}</div>
            <h3 className="text-base font-extrabold text-rosa-900 mt-0.5">{card.title}</h3>
            <p className="text-xs text-gray-600 mt-1">{card.body}</p>
          </div>
        ))}
      </div>

      {/* SQL Schema Viewer com botão de copiar */}
      <div className="bg-white rounded-2xl p-5 border border-rosa-200 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-extrabold text-rosa-800">🗄️ Script DDL Completo — PostgreSQL + pgvector + OWASP/LGPD</h2>
            <p className="text-xs text-gray-600">Pronto para colar no SQL Editor do Neon.tech ou Supabase.</p>
          </div>
          <button
            id="btnCopySqlSchema"
            type="button"
            onClick={() => void handleCopy()}
            className="px-4 py-2 rounded-full bg-rosa-800 hover:bg-rosa-900 text-white font-bold text-xs shadow transition"
          >
            📋 Copiar Script SQL Completo
          </button>
        </div>
        <pre
          id="sqlCodeBlock"
          className="bg-gray-950 text-emerald-300 p-4 rounded-xl text-[11px] font-mono overflow-x-auto max-h-96 custom-scroll leading-relaxed"
        >
          {schemaSql}
        </pre>
      </div>
    </section>
  );
}
