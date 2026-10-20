import logoRosaia from '../../assets/logo-rosaia.png';
import logoUniceplac from '../../assets/logo-uniceplac.png';
import { MISSION_CARDS, SCIENTIFIC_ARTICLES } from '../../data/aboutContent';

/** Painel "Sobre" com missão do projeto, UNICEPLAC e referências científicas. */
export default function AboutSection() {
  return (
    <section id="tabContentSobre" className="p-6 space-y-5 bg-rosa-50/40">
      <div className="bg-white rounded-2xl p-6 border border-rosa-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-rosa-100 pb-4">
          <div className="flex items-center gap-3">
            <img src={logoRosaia} alt="Logo RosaIA" className="w-14 h-14 object-contain" />
            <div>
              <h2 className="text-xl font-extrabold text-rosa-800">Sobre o Projeto RosaIA APP</h2>
              <p className="text-xs text-gray-600">
                Iniciativa Científica Interdisciplinar — Centro Universitário UNICEPLAC (Brasília/DF)
              </p>
            </div>
          </div>
          <img src={logoUniceplac} alt="UNICEPLAC" className="h-12 object-contain" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {MISSION_CARDS.map((card) => (
            <div key={card.title} className="p-4 rounded-xl bg-rosa-50 border border-rosa-200">
              <h3 className="font-bold text-rosa-800 text-sm mb-1">{card.title}</h3>
              <p className="text-gray-700 leading-relaxed">{card.text}</p>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <h3 className="font-extrabold text-sm text-rosa-800">
            📚 Artigos Científicos e Publicações que Fundamentam o Projeto:
          </h3>
          <ul className="space-y-2 text-xs text-gray-700">
            {SCIENTIFIC_ARTICLES.map((article) => (
              <li key={article.heading} className="p-3 rounded-xl bg-white border border-rosa-200">
                <strong>{article.heading}</strong> <em>"{article.title}"</em> {article.credits}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
