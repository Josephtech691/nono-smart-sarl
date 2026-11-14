import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Fish, Heart, Check, Share2, ChevronRight, Leaf, BadgeCheck, Truck, BadgePercent, ShieldCheck, Star,
  ShoppingCart,
} from 'lucide-react';
import { productsApi } from '../api/catalog';
import { favoritesApi } from '../api/extras';
import { useCartStore, buildLine } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { usePricesStore } from '../store/pricesStore';
import { activeVariants, availableStock, variantAvailable } from '../utils/products';
import { toast } from '../store/toastStore';
import { formatFCFA, formatDate, formatQuantity, UNIT_LABELS } from '../utils/format';
import { getUnitPriceForQuantity, nextTierHint, getTierRows } from '../utils/pricing';
import usePageMeta from '../utils/usePageMeta';
import QuantityStepper from '../components/QuantityStepper';
import StarRating from '../components/StarRating';
import ProductCard from '../components/ProductCard';
import Loader from '../components/Loader';

const FEATURES = [
  { icon: Leaf, label: 'Produit frais' },
  { icon: BadgeCheck, label: 'Qualité garantie' },
  { icon: Truck, label: 'Livraison rapide' },
];

const unitText = (unit) => (UNIT_LABELS[unit] || unit || '').toUpperCase();

const absoluteUrl = (url) => {
  try {
    return new URL(url, window.location.origin).href;
  } catch (e) {
    return undefined;
  }
};

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const addItem = useCartStore((s) => s.addItem);
  const startDirectMany = useCartStore((s) => s.startDirectMany);

  const [product, setProduct] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [isFavorite, setIsFavorite] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState('');
  const [imgFailed, setImgFailed] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [recommendations, setRecommendations] = useState([]);
  const [tab, setTab] = useState('description');
  // Produit à variantes : nombre de pièces voulu pour chaque poids (id de variante -> quantité) + photo affichée.
  const [variantQty, setVariantQty] = useState({});
  const [variantImage, setVariantImage] = useState(null);
  const specialPrices = usePricesStore((st) => st.prices);

  const customer = user?.customerProfile;
  const isWholesale = customer?.customerType === 'PROFESSIONNEL' && customer?.professionalStatus === 'APPROVED';

  usePageMeta(product?.name, product?.description?.slice(0, 160));

  useEffect(() => {
    let ignore = false;
    setProduct(null);
    setLoadError(false);
    setActiveImage(0);
    setImgFailed(false);
    setTab('description');
    setVariantQty({});
    setVariantImage(null);
    productsApi
      .get(slug)
      .then((p) => {
        if (ignore) return;
        setProduct(p);
        setQuantity(p.minOrderQuantity || 1);
        productsApi.recommendations(p.id).then((r) => !ignore && setRecommendations(r)).catch(() => !ignore && setRecommendations([]));
      })
      .catch(() => !ignore && setLoadError(true));
    return () => {
      ignore = true;
    };
  }, [slug]);

  useEffect(() => {
    if (user?.role === 'CUSTOMER' && product?.id) {
      favoritesApi.list().then((favs) => setIsFavorite(favs.some((f) => f.productId === product.id))).catch(() => {});
    }
  }, [user, product?.id]);

  if (loadError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center sm:px-6">
        <Fish size={44} className="mx-auto text-ink/20" strokeWidth={1.3} />
        <h1 className="mt-4 text-xl font-bold">Produit introuvable</h1>
        <p className="mt-1 text-ink/60">Ce produit n'existe plus ou n'est plus disponible.</p>
        <Link to="/produits" className="btn-primary mt-6 inline-flex">Voir tous les produits</Link>
      </div>
    );
  }
  if (!product) return <Loader />;

  const variants = activeVariants(product);
  const hasVar = variants.length > 0;
  const available = availableStock(product);
  const unitPrice = getUnitPriceForQuantity(product, quantity, customer, specialPrices);
  // Prix d'une pièce d'une variante (prix négocié du client si l'administration en a fixé un).
  const variantPrice = (v) => getUnitPriceForQuantity({ id: product.id, variantId: v.id, price: v.price, priceTiers: [] }, 1, customer, specialPrices);
  const hasSpecial = specialPrices.some((p) => p.productId === product.id);
  const chosen = variants.filter((v) => (variantQty[v.id] || 0) > 0);
  const totalPieces = chosen.reduce((sum, v) => sum + variantQty[v.id], 0);
  const variantsTotal = chosen.reduce((sum, v) => sum + variantPrice(v) * variantQty[v.id], 0);
  const fromPrice = hasVar ? Math.min(...variants.map(variantPrice)) : unitPrice;
  const lineTotal = Math.round(unitPrice * quantity);
  const hint = nextTierHint(product, quantity);
  const tierRows = getTierRows(product);
  const activeTier = tierRows.reduce((acc, row, i) => (quantity >= row.minQuantity ? i : acc), -1);
  const unit = unitText(product.unit);
  const reviewStats = product.reviewStats || { count: 0, average: 0 };
  const images = product.images || [];
  const image = variantImage || images[activeImage]?.url;
  const isFresh = product.category?.slug === 'silures-frais';
  const isWeightUnit = product.unit === 'KILOGRAM' || product.unit === 'GRAM';
  // "2,5 kg" pour les produits au poids, "50 pièce" etc. pour les autres.
  const qtyWithUnit = (q) => (isWeightUnit ? formatQuantity(q, product.unit) : `${formatQuantity(q, product.unit)} ${UNIT_LABELS[product.unit]}`);

  const setVariantQuantity = (v, q) => {
    const max = variantAvailable(v);
    setVariantQty((prev) => ({ ...prev, [v.id]: Math.max(0, Math.min(max, Math.floor(Number(q) || 0))) }));
  };

  const handleAddVariants = () => {
    setError('');
    if (totalPieces === 0) return setError('Indiquez le nombre de pièces pour au moins un poids.');
    chosen.forEach((v) => addItem(product, variantQty[v.id], v));
    toast.success(`${totalPieces} pièce${totalPieces > 1 ? 's' : ''} ajoutée${totalPieces > 1 ? 's' : ''} au panier`);
    setVariantQty({});
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleAdd = () => {
    if (hasVar) return handleAddVariants();
    setError('');
    if (quantity < product.minOrderQuantity) {
      return setError(`Quantité minimum : ${qtyWithUnit(product.minOrderQuantity)}`);
    }
    if (quantity > available) {
      return setError(`Stock disponible : ${qtyWithUnit(available)}`);
    }
    addItem(product, quantity);
    toast.success(`${product.name} ajouté au panier`);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  // « Commander maintenant » : même contrôles que l'ajout au panier, mais on commande directement,
  // sans passer par le panier (qui reste inchangé).
  const handleBuyNow = () => {
    setError('');
    if (hasVar) {
      if (totalPieces === 0) return setError('Indiquez le nombre de pièces pour au moins un poids.');
      startDirectMany(chosen.map((v) => buildLine(product, variantQty[v.id], v)));
    } else {
      if (quantity < product.minOrderQuantity) return setError(`Quantité minimum : ${qtyWithUnit(product.minOrderQuantity)}`);
      if (quantity > available) return setError(`Stock disponible : ${qtyWithUnit(available)}`);
      startDirectMany([buildLine(product, quantity)]);
    }
    navigate('/checkout');
  };

  const toggleFavorite = async () => {
    if (!user) return navigate('/connexion', { state: { from: { pathname: `/produits/${product.slug}` } } });
    try {
      if (isFavorite) {
        await favoritesApi.remove(product.id);
        setIsFavorite(false);
      } else {
        await favoritesApi.add(product.id);
        setIsFavorite(true);
        toast.success('Ajouté à vos favoris');
      }
    } catch (err) {
      toast.error(err.message || 'Action impossible');
    }
  };

  const share = async () => {
    const url = window.location.href;
    const data = { title: product.name, text: `${product.name} — Fresh Fish`, url };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(url);
        toast.success('Lien copié');
      }
    } catch (e) {
      // partage annule par l'utilisateur : rien a faire
    }
  };

  // Donnees structurees (Google : prix, disponibilite, note) - lues par les moteurs de recherche.
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || undefined,
    image: images.map((i) => absoluteUrl(i.url)).filter(Boolean),
    brand: { '@type': 'Brand', name: 'Fresh Fish' },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'XAF',
      price: fromPrice,
      availability: available > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: window.location.href,
    },
    ...(reviewStats.count > 0
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: reviewStats.average, reviewCount: reviewStats.count } }
      : {}),
  };

  const TABS = [
    { id: 'description', label: 'Description' },
    { id: 'informations', label: 'Informations' },
    { id: 'avis', label: `Avis (${reviewStats.count})` },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      {/* Fil d'Ariane */}
      <nav aria-label="Fil d'Ariane" className="mb-5 flex flex-wrap items-center gap-1 text-sm text-ink/50">
        <Link to="/" className="hover:text-ink">Accueil</Link>
        <ChevronRight size={14} />
        <Link to={`/produits?category=${product.category.slug}`} className="hover:text-ink">{product.category.name}</Link>
        <ChevronRight size={14} />
        <span className="font-medium text-ink">{product.name}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-2 md:gap-12">
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
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => { setActiveImage(i); setVariantImage(null); setImgFailed(false); }}
                  aria-label={`Photo ${i + 1}`}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                    !variantImage && activeImage === i ? 'border-brand-600' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <span className={`badge ${available >= (hasVar ? 1 : product.minOrderQuantity || 1) ? 'bg-brand-500/15 text-brand-700' : 'bg-red-100 text-red-700'}`}>
            {available >= (hasVar ? 1 : product.minOrderQuantity || 1) ? 'En stock' : 'Rupture de stock'}
          </span>

          <div className="mt-2 flex items-start justify-between gap-3">
            <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{product.name}</h1>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={share}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink/50 transition hover:text-ink"
                aria-label="Partager ce produit"
              >
                <Share2 size={17} />
              </button>
              <button
                onClick={toggleFavorite}
                aria-pressed={isFavorite}
                className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${
                  isFavorite ? 'border-red-200 bg-red-50 text-red-500' : 'border-line text-ink/40 hover:text-red-500'
                }`}
                aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              >
                <Heart size={18} className={isFavorite ? 'fill-current' : ''} />
              </button>
            </div>
          </div>

          {reviewStats.count > 0 && (
            <button onClick={() => setTab('avis')} className="mt-1.5 flex items-center gap-2 text-sm text-ink/60 hover:text-ink">
              <StarRating value={Math.round(reviewStats.average)} readOnly size={15} />
              <span>{reviewStats.average.toFixed(1)} · {reviewStats.count} avis</span>
            </button>
          )}

          <div className="mt-4 flex flex-wrap items-end gap-x-2">
            {hasVar && <span className="pb-1 text-sm text-ink/50">à partir de</span>}
            <p className="font-display text-3xl font-bold text-pine-900">{formatFCFA(fromPrice)}</p>
            <span className="pb-1 text-sm text-ink/50">{hasVar ? '/ pièce' : `/ ${unit}`}</span>
            {hasSpecial && <span className="badge mb-1.5 bg-amber-100 text-amber-800"><BadgePercent size={12} /> Votre prix négocié</span>}
            {isWholesale && !hasSpecial && <span className="badge mb-1.5 bg-amber-100 text-amber-800"><BadgePercent size={12} /> Tarif pro -{customer.wholesaleDiscountPercent}%</span>}
          </div>
          {tierRows.length > 1 && !hasSpecial && <p className="text-sm text-ink/55">Prix dégressif selon la quantité</p>}

          {tierRows.length > 1 && !hasSpecial && (
            <div className="mt-4 overflow-hidden rounded-xl2 border border-line">
              <table className="w-full text-sm">
                <thead className="bg-mist text-xs text-ink/50">
                  <tr>
                    <th scope="col" className="px-4 py-2 text-left font-medium">Quantité ({unit})</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Prix / {unit}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {tierRows.map((row, i) => (
                    <tr key={row.minQuantity} className={activeTier === i ? 'bg-brand-500/10 font-semibold text-brand-700' : 'text-ink/70'}>
                      <td className="px-4 py-2">
                        {row.maxQuantity == null
                          ? `${formatQuantity(row.minQuantity, product.unit).replace(/ (kg|g)$/, '')} ${unit} et +`
                          : `${formatQuantity(row.minQuantity, product.unit).replace(/ (kg|g)$/, '')} - ${formatQuantity(row.maxQuantity, product.unit).replace(/ (kg|g)$/, '')} ${unit}`}
                      </td>
                      <td className="px-4 py-2 text-right">{formatFCFA(row.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {hint && !hasSpecial && !hasVar && (
            <p className="mt-2 text-xs font-medium text-brand-700">
              Ajoutez {qtyWithUnit(hint.minQuantity - quantity)} de plus pour passer à {formatFCFA(hint.unitPrice)} / {unit.toLowerCase()}
            </p>
          )}

          {hasVar ? (
            <div className="mt-5">
              <p className="label">Choisissez le poids et le nombre de pièces</p>
              <ul className="divide-y divide-line overflow-hidden rounded-xl2 border border-line">
                {variants.map((v) => {
                  const stock = variantAvailable(v);
                  const qty = variantQty[v.id] || 0;
                  return (
                    <li key={v.id} className={`flex items-center gap-3 p-3 ${qty > 0 ? 'bg-brand-500/5' : ''}`}>
                      <button
                        type="button"
                        onClick={() => { if (v.imageUrl) { setVariantImage(v.imageUrl); setImgFailed(false); window.scrollTo({ top: 0, behavior: 'smooth' }); } }}
                        aria-label={`Voir la photo ${v.label}`}
                        className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-mist"
                      >
                        {v.imageUrl ? (
                          <img src={v.imageUrl} alt={`${product.name} ${v.label}`} loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-pine-700/30"><Fish size={24} strokeWidth={1.3} /></span>
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="font-display font-semibold text-ink">{v.label}</p>
                        <p className="text-sm text-ink/60">{formatFCFA(variantPrice(v))} / pièce</p>
                        {stock > 0 && stock <= 5 && <p className="text-xs font-medium text-amber-700">Plus que {stock} en stock</p>}
                      </div>
                      {stock > 0 ? (
                        <QuantityStepper value={qty} onChange={(q) => setVariantQuantity(v, q)} min={0} max={stock} step={1} />
                      ) : (
                        <span className="badge bg-red-100 text-red-700">Rupture</span>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-sm text-ink/60">{totalPieces} pièce{totalPieces > 1 ? 's' : ''} sélectionnée{totalPieces > 1 ? 's' : ''}</p>
                <p className="font-display text-lg font-bold text-ink">{formatFCFA(variantsTotal)}</p>
              </div>
            </div>
          ) : (
          <div className="mt-5">
            <p className="label">Quantité ({unit})</p>
            <div className="flex flex-wrap items-center gap-4">
              <QuantityStepper
                value={quantity}
                onChange={setQuantity}
                min={product.minOrderQuantity}
                max={available > 0 ? available : undefined}
                step={product.unit === 'KILOGRAM' || product.unit === 'GRAM' ? 0.5 : 1}
              />
              <p className="font-display text-lg font-bold text-ink">{formatFCFA(lineTotal)}</p>
            </div>
          </div>
          )}

          {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button onClick={handleBuyNow} disabled={hasVar ? available < 1 : available < (product.minOrderQuantity || 1)} className="btn-primary w-full">
              Commander maintenant
            </button>
            <button onClick={handleAdd} disabled={hasVar ? available < 1 : available < (product.minOrderQuantity || 1)} className="btn-secondary w-full">
              {added ? (<><Check size={17} /> Ajouté au panier</>) : (<><ShoppingCart size={17} /> Ajouter au panier</>)}
            </button>
          </div>

          <ul className="mt-5 grid grid-cols-3 gap-2 border-y border-line py-4 text-center text-xs font-medium text-ink/70 sm:text-sm">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex flex-col items-center gap-1.5 sm:flex-row sm:justify-center">
                <Icon size={17} className="text-brand-600" /> {label}
              </li>
            ))}
          </ul>

          {tierRows.length > 1 && !hasSpecial && (
            <div className="mt-4 flex items-center gap-3 rounded-xl2 bg-pine-900 px-4 py-3 text-white">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600">
                <BadgePercent size={19} />
              </span>
              <p className="font-display text-sm font-semibold leading-snug">Plus vous achetez, moins vous payez !</p>
            </div>
          )}

          <div className="mt-4 flex items-center gap-2 text-xs text-ink/50">
            <ShieldCheck size={15} className="text-brand-600" /> Paiement sécurisé — MTN Mobile Money ou Orange Money
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div className="mt-12">
        <div role="tablist" aria-label="Détails du produit" className="flex gap-1 border-b border-line">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-4 py-3 text-sm font-semibold transition ${
                tab === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink/50 hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="py-6">
          {tab === 'description' && (
            <div className="max-w-3xl space-y-3 text-ink/70">
              <p>{product.description || 'Aucune description pour ce produit.'}</p>
              {isFresh && (
                <p>
                  <strong className="text-ink">Conservation :</strong> à conserver au frais, entre 0 °C et 4 °C.
                </p>
              )}
              <p>
                <strong className="text-ink">Livraison :</strong> partout à Yaoundé.
              </p>
            </div>
          )}

          {tab === 'informations' && (
            <dl className="grid max-w-3xl gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
              {[
                ['Catégorie', product.category.name],
                ['Vendu', hasVar ? 'à la pièce, au poids choisi' : `au ${UNIT_LABELS[product.unit] || 'lot'}`],
                ...(hasVar ? [] : [['Quantité minimale', qtyWithUnit(product.minOrderQuantity)]]),
                ['Disponibilité', available >= (hasVar ? 1 : product.minOrderQuantity || 1) ? 'En stock' : 'Rupture de stock'],
                ['Livraison', 'Partout à Yaoundé · 1 000 FCFA'],
                ['Paiement', 'MTN Mobile Money, Orange Money'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b border-line pb-2">
                  <dt className="text-ink/50">{label}</dt>
                  <dd className="text-right font-medium text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          {tab === 'avis' && (
            <div className="max-w-3xl">
              {reviewStats.count === 0 ? (
                <p className="text-ink/60">
                  Pas encore d'avis sur ce produit. Les clients dont la commande a été livrée peuvent donner leur avis depuis leur espace « Mes commandes ».
                </p>
              ) : (
                <>
                  <div className="mb-5 flex items-center gap-3">
                    <span className="font-display text-4xl font-bold text-ink">{reviewStats.average.toFixed(1)}</span>
                    <div>
                      <StarRating value={Math.round(reviewStats.average)} readOnly size={18} />
                      <p className="text-sm text-ink/50">{reviewStats.count} avis</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {product.reviews.map((r) => (
                      <article key={r.id} className="card p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pine-900 text-xs text-white">
                              {r.authorName?.charAt(0) || <Star size={13} />}
                            </span>
                            {r.authorName}
                          </p>
                          <span className="text-xs text-ink/40">{formatDate(r.createdAt).replace(/\s\d{2}:\d{2}$/, '')}</span>
                        </div>
                        <div className="mt-2">
                          <StarRating value={Math.round((r.quality + r.delivery + r.service) / 3)} readOnly size={15} />
                        </div>
                        {r.comment && <p className="mt-2 text-sm text-ink/70">{r.comment}</p>}
                      </article>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {recommendations.length > 0 && (
        <div className="mt-10 border-t border-line pt-10">
          <h2 className="mb-5 text-xl font-bold">Les clients ont aussi acheté</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {recommendations.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
