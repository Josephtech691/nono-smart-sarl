import { Star } from 'lucide-react';

export default function StarRating({ value = 0, onChange, readOnly = false, size = 20 }) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className="flex items-center gap-1">
      {stars.map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          className={readOnly ? 'cursor-default' : 'cursor-pointer'}
          aria-label={`${n} étoiles`}
        >
          <Star
            size={size}
            className={n <= value ? 'fill-amber-400 text-amber-400' : 'text-line'}
          />
        </button>
      ))}
    </div>
  );
}
