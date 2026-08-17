import { Link } from 'react-router-dom';
import { Fish } from 'lucide-react';
import { useState } from 'react';
import { formatFCFA, UNIT_LABELS } from '../utils/format';

export default function ProductCard({ product }) {
  const [imgFailed, setImgFailed] = useState(false);
  const image = product.images?.[0]?.url;
  const available = product.stockQuantity - product.reservedQuantity;
  const lowStock = available <= product.alertThreshold && available > 0;
  const outOfStock = available <= 0;

  return (
    <Link
      to={`/produits/${product.slug}`}
      className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-mist">
        {image && !imgFailed ? (
          <img
            src={image}
            alt={product.name}
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-pine-700/30">
            <Fish size={48} strokeWidth={1.2} />
          </div>
        )}
        {outOfStock && (
          <span className="absolute left-3 top-3 badge bg-ink/80 text-white">Rupture de stock</span>
        )}
        {!outOfStock && lowStock && (
          <span className="absolute left-3 top-3 badge bg-amber-500 text-white">Stock limité</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="font-display text-base font-semibold text-ink">{product.name}</h3>
        {product.description && <p className="line-clamp-2 text-sm text-ink/60">{product.description}</p>}
        <div className="mt-auto flex items-end justify-between pt-3">
          <div>
            <span className="text-xs text-ink/50">à partir de</span>
            <p className="font-display text-lg font-bold text-pine-900">
              {formatFCFA(product.price)}
              <span className="ml-1 text-sm font-medium text-ink/50">/ {UNIT_LABELS[product.unit]}</span>
            </p>
          </div>
          <span className="btn-primary !px-4 !py-2 text-sm">Voir</span>
        </div>
      </div>
    </Link>
  );
}
