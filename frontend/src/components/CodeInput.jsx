import { useRef } from 'react';

/**
 * Saisie d'un code à chiffres en cases séparées (code de confirmation de livraison).
 * `value` est une chaîne de chiffres sans « trous » ; avance automatiquement, gère la
 * suppression, les flèches, le collage (« 4827 ») et le remplissage automatique.
 */
export default function CodeInput({ value, onChange, length = 4, disabled = false, invalid = false, autoFocus = false, label = 'Code de confirmation' }) {
  const refs = useRef([]);
  const focusAt = (i) => {
    const el = refs.current[Math.max(0, Math.min(length - 1, i))];
    if (el) el.focus();
  };

  // Remplace le chiffre de la case (ou l'ajoute à la fin : jamais de trou dans le code).
  const setDigit = (index, digit) => {
    const pos = Math.min(index, value.length);
    onChange((value.slice(0, pos) + digit + value.slice(pos + 1)).slice(0, length));
    focusAt(pos + 1);
  };

  // Collage ou remplissage automatique du code complet.
  const fill = (raw) => {
    const digits = String(raw).replace(/\D/g, '').slice(0, length);
    if (!digits) return;
    onChange(digits);
    focusAt(digits.length);
  };

  const removeAt = (index) => onChange(value.slice(0, index) + value.slice(index + 1));

  const handleChange = (index, text) => {
    const typed = text.replace(/\D/g, '');
    if (!typed) {
      // Case vidée sans événement « Backspace » (certains claviers mobiles).
      if (text === '' && value[index]) removeAt(index);
      return;
    }
    if (typed.length >= length) return fill(typed);
    const old = value[index] || '';
    // Frappe dans une case déjà remplie : on garde le nouveau chiffre, pas l'ancien.
    const digit = old && typed.length > 1 ? typed.replace(old, '') || old : typed.slice(-1);
    setDigit(index, digit);
  };

  return (
    <div role="group" aria-label={label} className="flex justify-center gap-3">
      {Array.from({ length }, (_, i) => {
        const digit = value[i] || '';
        return (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            autoFocus={autoFocus && i === 0}
            disabled={disabled}
            value={digit}
            aria-label={`${label}, chiffre ${i + 1} sur ${length}`}
            aria-invalid={invalid || undefined}
            onFocus={(e) => e.target.select()}
            onChange={(e) => handleChange(i, e.target.value)}
            onPaste={(e) => {
              e.preventDefault();
              fill(e.clipboardData.getData('text'));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Backspace') {
                e.preventDefault();
                if (value[i]) removeAt(i);
                else if (i > 0) {
                  removeAt(i - 1);
                  focusAt(i - 1);
                }
              } else if (e.key === 'Delete') {
                e.preventDefault();
                removeAt(i);
              } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                focusAt(i - 1);
              } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                focusAt(i + 1);
              }
            }}
            className={`h-14 w-12 rounded-xl border-2 bg-white text-center font-display text-2xl font-bold text-ink outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-500/20 disabled:opacity-50 ${
              invalid ? 'border-red-400' : digit ? 'border-brand-600 bg-brand-500/5' : 'border-line'
            }`}
          />
        );
      })}
    </div>
  );
}
