import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Fish, Heart, ShieldCheck, Check } from 'lucide-react';
import { productsApi } from '../api/catalog';
import { favoritesApi } from '../api/extras';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { formatFCFA, UNIT_LABELS } from '../utils/format';
import { getUnitPriceForQuantity, nextTierHint } from '../utils/pricing';
import QuantityStepper from '../components/QuantityStepper';
import StarRating from '../components/StarRating';
import ProductCard from '../components/ProductCard';
import Loader from '../components/Loader';

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const addItem = useCartStore((s) => s.addItem);

  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [isFavorite, setIsFavorite] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState('');
  const [imgFailed, setImgFailed] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    setProduct(null);
    setActiveImage(0);
    setImgFailed(false);
    productsApi.get(slug).then((p) => {
      setProduct(p);
      setQuantity(p.minOrderQuantity || 1);
      productsApi.recommendations(p.id).then(setRecommendations).catch(() => setRecommendations([]));
    });
  }, [slug]);

  useEffect(() => {
    if (user?.role === 'CUSTOMER') {
      favoritesApi.list().then((favs) => setIsFavorite(favs.some((f) => f.productId === product?.id))).catch(() => {});
    }
  }, [user, product?.id]);

  if (!product) return <Loader />;

  const available = product.stockQuantity - product.reservedQuantity;
  const unitPrice = getUnitPriceForQuantity(product, quantity);
  const lineTotal = Math.round(unitPrice * quantity);
  const hint = nextTierHint(product, quantity);

  const handleAdd = () => {
    setError('');
    if (quantity < product.minOrderQuantity) {
      return setError(`Quantité minimum : ${product.minOrderQuantity} ${UNIT_LABELS[product.unit]}`);
    }
    if (quantity > available) {
      return setError(`Stock disponible : ${available} ${UNIT_LABELS[product.unit]}`);
    }
    addItem(product, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const toggleFavorite = async () => {
    if (!user) return navigate('/connexion');
    if (isFavorite) {
      await favoritesApi.remove(product.id);
      setIsFavorite(false);
    } else {
      await favoritesApi.add(product.id);
      setIsFavorite(true);
    }
  };

  const images = product.images || [];
  const image = images[activeImage]?.url;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="grid gap-10 md:grid-cols-2">
        <div>
          <div className="aspect-square overflow-hidden rounded-xl2 bg-mist">
            {image && !imgFailed ? (
              <img src={image} alt={product.name} onError={() => setImgFailed(true)} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-pine-700/30">
                <Fish size={90} strokeWidth={1} />
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => { setActiveImage(i); setImgFailed(false); }}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                    activeImage === i ? 'border-brand-600' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <Link to={`/produits?category=${product.category.slug}`} className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            {product.category.name}
          </Link>
          <div className="mt-1 flex items-start justify-between gap-3">
            <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{product.name}</h1>
            <button
              onClick={toggleFavorite}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition ${
                isFavorite ? 'border-red-200 bg-red-50 text-red-500' : 'border-line text-ink/40 hover:text-red-500'
              }`}
              aria-label="Ajouter aux favoris"
            >
              <Heart size={18} className={isFavorite ? 'fill-current' : ''} />
            </button>
          </div>
          {product.description && <p className="mt-3 text-ink/65">{product.description}</p>}

          <div className="mt-5 flex items-center gap-2 text-sm">
            <span className={`badge ${available > 0 ? 'bg-brand-500/15 text-brand-700' : 'bg-red-100 text-red-700'}`}>
              {available > 0 ? `En stock (${available} ${UNIT_LABELS[product.unit]} disponibles)` : 'Rupture de stock'}
            </span>
          </div>

          {product.priceTiers?.length > 0 && (
            <div className="mt-5 rounded-xl2 border border-line bg-mist/60 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/50">Prix dégressif selon la quantité</p>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                {[...product.priceTiers]
                  .sort((a, b) => a.minQuantity - b.minQuantity)
                  .map((t) => (
                    <li key={t.minQuantity} className={unitPrice === t.unitPrice ? 'font-semibold text-brand-700' : 'text-ink/70'}>
                      {t.minQuantity}+ {UNIT_LABELS[product.unit]} : {formatFCFA(t.unitPrice)}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <div className="mt-6 flex items-end gap-2">
            <p className="font-display text-3xl font-bold text-pine-900">{formatFCFA(unitPrice)}</p>
            <span className="pb-1 text-sm text-ink/50">/ {UNIT_LABELS[product.unit]}</span>
          </div>
          {hint && (
            <p className="mt-1 text-xs text-brand-700">
              Ajoutez {(hint.minQuantity - quantity).toFixed(2).replace(/\.00$/, '')} de plus pour passer à {formatFCFA(hint.unitPrice)} / {UNIT_LABELS[product.unit]}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <QuantityStepper value={quantity} onChange={setQuantity} min={product.minOrderQuantity} max={available} step={product.unit === 'KILOGRAM' || product.unit === 'GRAM' ? 0.5 : 1} />
            <p className="font-display text-lg font-bold text-ink">{formatFCFA(lineTotal)}</p>
          </div>

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          <button onClick={handleAdd} disabled={available <= 0} className="btn-primary mt-5 w-full sm:w-auto">
            {added ? (
              <>
                <Check size={17} /> Ajouté au panier
              </>
            ) : (
              'Ajouter au panier'
            )}
          </button>

          <div className="mt-6 flex items-center gap-2 text-xs text-ink/50">
            <ShieldCheck size={15} className="text-brand-600" /> Paiement sécurisé — MTN Mobile Money, Orange Money ou espèces à la livraison
          </div>
        </div>
      </div>

      {recommendations.length > 0 && (
        <div className="mt-16 border-t border-line pt-10">
          <h2 className="mb-5 text-xl font-bold">Les clients ont aussi acheté</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {recommendations.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}

      {product.reviews?.length > 0 && (
        <div className="mt-16 border-t border-line pt-10">
          <h2 className="mb-5 text-xl font-bold">Avis clients</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {product.reviews.map((r) => (
              <div key={r.id} className="card p-4">
                <StarRating value={Math.round((r.quality + r.delivery + r.service) / 3)} readOnly size={16} />
                {r.comment && <p className="mt-2 text-sm text-ink/70">{r.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
