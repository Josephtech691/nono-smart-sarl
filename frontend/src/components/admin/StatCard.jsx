import { Link } from 'react-router-dom';
import { TrendingDown, TrendingUp } from 'lucide-react';

const TONES = {
  brand: 'bg-brand-500/15 text-brand-700',
  sky: 'bg-sky-100 text-sky-700',
  amber: 'bg-amber-100 text-amber-700',
  violet: 'bg-violet-100 text-violet-700',
  red: 'bg-red-100 text-red-700',
};

/** Variation en % (+12 %, −5 %). Rien n'est affiché quand il n'y a rien à comparer (valeur `null`). */
export function Trend({ value, suffix }) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  const number = Number(value);
  const Icon = number > 0 ? TrendingUp : TrendingDown;
  const color = number === 0 ? 'text-ink/50' : number > 0 ? 'text-brand-700' : 'text-red-600';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${color}`} data-testid="trend">
      {number !== 0 && <Icon size={13} aria-hidden="true" />}
      {number > 0 ? '+' : number < 0 ? '−' : ''}
      {Math.abs(number).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %{suffix && <span className="font-normal text-ink/50"> {suffix}</span>}
    </span>
  );
}

/**
 * Carte d'indicateur : pastille d'icône, intitulé, valeur, variation éventuelle et petite ligne d'aide.
 * Avec `to`, toute la carte est un lien (accès direct à la liste correspondante).
 */
export default function StatCard({ icon: Icon, label, value, sub, delta, deltaSuffix, tone = 'brand', to, testId }) {
  const body = (
    <>
      <span className={`flex h-10 w-10 items-center justify-center rounded-full ${TONES[tone] || TONES.brand}`}>
        <Icon size={19} aria-hidden="true" />
      </span>
      <p className="mt-3 text-sm font-medium text-ink/60">{label}</p>
      <p className="mt-0.5 font-display text-2xl font-bold text-ink" data-testid={testId}>
        {value}
      </p>
      <div className="mt-1 flex min-h-[1rem] flex-wrap items-center gap-x-2 text-xs text-ink/50">
        <Trend value={delta} suffix={deltaSuffix} />
        {sub && <span>{sub}</span>}
      </div>
    </>
  );
  const base = 'card block p-4 sm:p-5';
  return to ? (
    <Link to={to} className={`${base} transition hover:border-brand-600/40 hover:shadow-md`}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  );
}
