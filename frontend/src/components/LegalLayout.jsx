import { Link } from 'react-router-dom';

/**
 * Mise en page des pages juridiques (conditions, confidentialite).
 * `sections` = [{ title, paragraphs: [...], list?: [...] }]
 */
export default function LegalLayout({ title, updated, intro, sections, otherLink }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-ink/50">Dernière mise à jour : {updated}</p>
      {intro && <p className="mt-6 text-ink/75">{intro}</p>}

      <nav aria-label="Sommaire" className="mt-8 rounded-xl2 border border-line bg-white p-5">
        <p className="font-display text-sm font-semibold text-ink">Sommaire</p>
        <ol className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          {sections.map((s, i) => (
            <li key={s.title}>
              <a href={`#article-${i + 1}`} className="text-ink/65 hover:text-brand-700">
                {i + 1}. {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-10 space-y-9">
        {sections.map((s, i) => (
          <section key={s.title} id={`article-${i + 1}`} className="scroll-mt-24">
            <h2 className="font-display text-xl font-semibold text-ink">
              {i + 1}. {s.title}
            </h2>
            <div className="mt-3 space-y-3 leading-relaxed text-ink/75">
              {s.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
              {s.list && (
                <ul className="list-disc space-y-1.5 pl-5">
                  {s.list.map((li) => (
                    <li key={li}>{li}</li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        ))}
      </div>

      {otherLink && (
        <p className="mt-12 border-t border-line pt-6 text-sm text-ink/60">
          Voir aussi : <Link to={otherLink.to} className="font-semibold text-brand-700 hover:underline">{otherLink.label}</Link>
        </p>
      )}
    </div>
  );
}
