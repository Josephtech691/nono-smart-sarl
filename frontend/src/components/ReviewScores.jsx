import StarRating from './StarRating';

const ROWS = [
  { key: 'quality', label: 'Qualité des produits' },
  { key: 'delivery', label: 'Livraison' },
  { key: 'service', label: 'Service' },
];

/** Les trois notes d'un avis (qualité / livraison / service), en lecture seule. */
export default function ReviewScores({ review, size = 16 }) {
  if (!review) return null;
  return (
    <dl className="space-y-1.5">
      {ROWS.map((row) => (
        <div key={row.key} className="flex items-center justify-between gap-3">
          <dt className="text-sm text-ink/70">{row.label}</dt>
          <dd aria-label={`${review[row.key]} sur 5`}>
            <StarRating value={Number(review[row.key]) || 0} readOnly size={size} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Moyenne arrondie à une décimale des trois notes d'un avis (ex. 4,7). */
export function averageScore(review) {
  if (!review) return 0;
  const values = [review.quality, review.delivery, review.service].map(Number).filter((n) => Number.isFinite(n));
  if (!values.length) return 0;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}
