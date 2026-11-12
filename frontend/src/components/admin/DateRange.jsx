import { useId } from 'react';

/**
 * Période « du … au … » d'une liste (deux champs date). La date de fin est incluse en entier côté serveur.
 * `onChange` reçoit seulement le champ modifié : { du } ou { au }.
 */
export default function DateRange({ from, to, onChange }) {
  const id = useId();
  const field = 'input !w-auto !py-2 text-sm';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={`${id}-from`} className="text-xs font-medium text-ink/55">
        Du
      </label>
      <input id={`${id}-from`} type="date" className={field} value={from} max={to || undefined} onChange={(e) => onChange({ du: e.target.value })} />
      <label htmlFor={`${id}-to`} className="text-xs font-medium text-ink/55">
        au
      </label>
      <input id={`${id}-to`} type="date" className={field} value={to} min={from || undefined} onChange={(e) => onChange({ au: e.target.value })} />
    </div>
  );
}
