import { useRef, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Fish, ShoppingCart, Check, ListPlus } from 'lucide-react';
import { availableStock, hasVariants, activeVariants } from '../utils/products';
import { useCartStore } from '../store/cartStore';
import { toast } from '../store/toastStore';
import { formatFCFA, UNIT_LABELS } from '../utils/format';

export default function ProductCard({ product }) {
  const [imgFailed, setImgFailed] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const addItem = useCartStore((s) => s.addItem);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const image = product.images?.[0]?.url;
  const withVariants = hasVariants(product);
  const available = availableStock(product);
  const minQuantity = withVariants ? 1 : product.minOrderQuantity || 1;
  const lowStock = available <= product.alertThreshold && available > 0;
  const outOfStock = available < minQuantity;
  const hasTiers = !withVariants && product.priceTiers?.length > 1;
  const fromPrice = withVariants ? Math.min(...activeVariants(product).map((v) => v.price)) : product.price;

  // Ajout rapide : la quantite minimale de vente (1 kg pour un silure, 50 pour des alevins...).
  const navigate = useNavigate();
  const startDirect = useCartStore((st) => st.startDirect);
  const buyNow = () => {
    if (outOfStock || withVariants) return;
    startDirect(product, minQuantity);
    navigate('/checkout');
  };
  const quickAdd = () => {
    if (outOfStock || withVariants) return;
    addItem(product, minQuantity);
    toast.success(`${product.name} ajouté au panier`);
    setJustAdded(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setJustAdded(false), 1600);
  };

  return (
    <div className="card group flex h-full flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <Link to={`/produits/${product.slug}`} className="flex flex-1 flex-col">
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
          {outOfStock && <span className="absolute left-3 top-3 badge bg-ink/80 text-white">Rupture de stock</span>}
          {!outOfStock && lowStock && <span className="absolute left-3 top-3 badge bg-amber-500 text-white">Stock limité</span>}
        </div>
        <div className="flex flex-1 flex-col gap-1 px-4 pt-4">
          <h3 className="font-display text-base font-semibold text-ink">{product.name}</h3>
          {product.description && <p className="line-clamp-2 text-sm text-ink/60">{product.description}</p>}
        </div>
      </Link>

      <div className="px-4 pb-4 pt-3">
        <div>
          <span className="text-xs text-ink/50">{hasTiers || withVariants ? 'à partir de' : 'prix'}</span>
          <p className="font-display text-lg font-bold leading-tight text-pine-900">
            {formatFCFA(fromPrice)}
            <span className="ml-1 text-sm font-medium text-ink/50">/ {withVariants ? 'pièce' : UNIT_LABELS[product.unit]}</span>
          </p>
          {withVariants && <p className="text-[11px] font-semibold text-brand-700">{activeVariants(product).length} poids au choix</p>}
          {hasTiers && <p className="text-[11px] font-semibold text-brand-700">Prix dégressif selon la quantité</p>}
        </div>

        {/* Deux actions : « Commander » (achat direct, sans panier) et une petite icône « Ajouter au panier ». */}
        {withVariants ? (
          <Link to={`/produits/${product.slug}`} className="btn-primary mt-3 w-full !py-2.5 text-sm">
            <ListPlus size={17} /> Choisir le poids
          </Link>
        ) : (
          <div className="mt-3 flex items-center gap-2">
            <button type="button" onClick={buyNow} disabled={outOfStock} className="btn-primary min-w-0 flex-1 !px-3 !py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-40">
              {outOfStock ? 'Indisponible' : 'Commander'}
            </button>
            <button
              type="button"
              onClick={quickAdd}
              disabled={outOfStock}
              aria-label={`Ajouter ${product.name} au panier`}
              title={outOfStock ? 'Rupture de stock' : 'Ajouter au panier'}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
                justAdded ? 'border-pine-900 bg-pine-900 text-white' : 'border-brand-600 bg-white text-brand-700 hover:bg-brand-500/10'
              }`}
            >
              {justAdded ? <Check size={18} /> : <ShoppingCart size={18} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
