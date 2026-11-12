import { Check } from 'lucide-react';

const STEPS = ['Adresse', 'Paiement', 'Confirmation'];

/**
 * Indicateur d'etapes du tunnel de commande (maquette : Adresse > Paiement > Confirmation).
 * `current` = index de l'etape en cours ; mettre 3 pour tout afficher comme termine.
 */
export default function CheckoutStepper({ current = 0 }) {
  return (
    <ol className="mx-auto flex w-full max-w-md items-start" aria-label="Étapes de la commande">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="relative flex flex-1 flex-col items-center" aria-current={active ? 'step' : undefined}>
            {i > 0 && (
              <span
                aria-hidden="true"
                className={`absolute right-1/2 top-4 -z-0 h-0.5 w-full ${i <= current ? 'bg-brand-600' : 'bg-line'}`}
              />
            )}
            <span
              className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold transition ${
                done
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : active
                  ? 'border-pine-900 bg-pine-900 text-white ring-4 ring-pine-900/10'
                  : 'border-line bg-white text-ink/35'
              }`}
            >
              {done ? <Check size={16} strokeWidth={3} /> : i + 1}
            </span>
            <span className={`mt-1.5 text-xs font-medium ${active ? 'text-ink' : done ? 'text-ink/70' : 'text-ink/40'}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
