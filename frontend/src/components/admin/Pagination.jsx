import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Numéros de page à afficher : toujours la première et la dernière, la page courante et ses voisines,
 * « … » pour les trous (un trou d'une seule page affiche directement son numéro). 1 … 4 [5] 6 … 20
 */
export function pageWindow(page, pages, around = 1) {
  const wanted = new Set([1, pages]);
  for (let p = page - around; p <= page + around; p++) {
    if (p >= 1 && p <= pages) wanted.add(p);
  }
  const sorted = [...wanted].sort((a, b) => a - b);
  const out = [];
  sorted.forEach((n, i) => {
    if (i > 0) {
      const gap = n - sorted[i - 1];
      if (gap === 2) out.push(n - 1);
      else if (gap > 2) out.push('…');
    }
    out.push(n);
  });
  return out;
}

/** Pagination d'une liste (« 21–40 sur 134 » + précédent / numéros / suivant). Rien à afficher sur une seule page. */
export default function Pagination({ page, limit, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (total <= limit) return null;
  const current = Math.min(Math.max(1, page), pages);
  const first = (current - 1) * limit + 1;
  const last = Math.min(total, current * limit);

  const arrow = 'flex h-9 w-9 items-center justify-center rounded-full text-ink/70 transition hover:bg-mist disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';

  return (
    <nav aria-label="Pagination" className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-ink/55">
        {first}–{last} sur {total}
      </p>
      <ul className="flex items-center gap-1">
        <li>
          <button type="button" className={arrow} disabled={current <= 1} onClick={() => onChange(current - 1)} aria-label="Page précédente">
            <ChevronLeft size={18} />
          </button>
        </li>
        {pageWindow(current, pages).map((n, i) =>
          n === '…' ? (
            <li key={`gap-${i}`} className="px-1 text-ink/40" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={n}>
              <button
                type="button"
                onClick={() => onChange(n)}
                aria-current={n === current ? 'page' : undefined}
                aria-label={`Page ${n}`}
                className={`h-9 min-w-[2.25rem] rounded-full px-2 text-sm font-semibold transition ${
                  n === current ? 'bg-pine-900 text-white' : 'text-ink/70 hover:bg-mist'
                }`}
              >
                {n}
              </button>
            </li>
          )
        )}
        <li>
          <button type="button" className={arrow} disabled={current >= pages} onClick={() => onChange(current + 1)} aria-label="Page suivante">
            <ChevronRight size={18} />
          </button>
        </li>
      </ul>
    </nav>
  );
}
