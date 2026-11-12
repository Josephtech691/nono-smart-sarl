import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Fish, ChevronRight, ArrowUpDown, X, SlidersHorizontal } from 'lucide-react';
import { productsApi, categoriesApi } from '../api/catalog';
import ProductCard from '../components/ProductCard';
import { ProductGridSkeleton } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import usePageMeta from '../utils/usePageMeta';

const PAGE_SIZE = 12;

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Pertinence' },
  { value: 'price_asc', label: 'Prix croissant' },
  { value: 'price_desc', label: 'Prix décroissant' },
  { value: 'name', label: 'Nom (A → Z)' },
];

// Photo de la banniere selon la categorie (les vraies photos de l'entreprise).
const bannerImage = (slug) => (slug === 'alevins' ? '/products/alevins-2.jpg' : '/products/silure-2.jpg');

// Panneau "Filtrer" : fourchette de prix + produits en stock uniquement.
function FilterPanel({ minPrice, maxPrice, inStock, onApply }) {
  const [open, setOpen] = useState(false);
  const [min, setMin] = useState(minPrice);
  const [max, setMax] = useState(maxPrice);
  const [stock, setStock] = useState(inStock);
  const rootRef = useRef(null);
  const activeCount = [minPrice, maxPrice, inStock ? 'x' : ''].filter(Boolean).length;

  useEffect(() => {
    setMin(minPrice);
    setMax(maxPrice);
    setStock(inStock);
  }, [minPrice, maxPrice, inStock]);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => rootRef.current && !rootRef.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const apply = (e) => {
    e.preventDefault();
    onApply({ minPrice: min, maxPrice: max, inStock: stock });
    setOpen(false);
  };
  const reset = () => {
    onApply({ minPrice: '', maxPrice: '', inStock: false });
    setOpen(false);
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm font-medium text-ink"
      >
        <SlidersHorizontal size={15} className="text-ink/40" /> Filtrer
        {activeCount > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">{activeCount}</span>
        )}
      </button>

      {open && (
        <form onSubmit={apply} className="card absolute right-0 z-20 mt-2 w-72 space-y-4 p-4 shadow-lg">
          <fieldset>
            <legend className="label">Prix (FCFA)</legend>
            <div className="flex items-center gap-2">
              <input type="number" inputMode="numeric" min="0" placeholder="Min" value={min} onChange={(e) => setMin(e.target.value)} className="input !py-2 text-sm" aria-label="Prix minimum" />
              <span className="text-ink/30">–</span>
              <input type="number" inputMode="numeric" min="0" placeholder="Max" value={max} onChange={(e) => setMax(e.target.value)} className="input !py-2 text-sm" aria-label="Prix maximum" />
            </div>
          </fieldset>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink/80">
            <input type="checkbox" checked={stock} onChange={(e) => setStock(e.target.checked)} className="h-4 w-4 rounded border-line text-brand-600" />
            Produits en stock uniquement
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={reset} className="btn-secondary flex-1 !px-3 !py-2 text-sm">Réinitialiser</button>
            <button type="submit" className="btn-primary flex-1 !px-3 !py-2 text-sm">Appliquer</button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function Catalogue() {
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get('category') || '';
  const searchTerm = searchParams.get('search') || '';
  const sort = SORT_OPTIONS.some((o) => o.value === searchParams.get('sort')) ? searchParams.get('sort') : 'relevance';

  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const inStock = searchParams.get('inStock') === 'true';

  const [search, setSearch] = useState(searchTerm);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const currentCategory = useMemo(() => categories.find((c) => c.slug === category), [categories, category]);

  usePageMeta(
    currentCategory ? currentCategory.name : 'Nos produits',
    currentCategory?.description || 'Silures frais et alevins livrés à Yaoundé. Prix dégressifs selon la quantité.'
  );

  useEffect(() => {
    categoriesApi.list().then(setCategories).catch(() => setCategories([]));
  }, []);

  // Parametres communs a la premiere page et au "Voir plus".
  const buildParams = (pageNumber) => {
    const params = { limit: PAGE_SIZE, page: pageNumber, sort };
    if (category) params.category = category;
    if (searchTerm) params.search = searchTerm;
    if (minPrice) params.minPrice = minPrice;
    if (maxPrice) params.maxPrice = maxPrice;
    if (inStock) params.inStock = 'true';
    return params;
  };

  // Garde le champ de recherche synchronise avec l'URL (retour arriere, lien partage...).
  useEffect(() => setSearch(searchTerm), [searchTerm]);

  // Nouveau filtre / tri / recherche -> on repart de la page 1.
  useEffect(() => {
    let ignore = false;
    setProducts(null);
    setPage(1);
    productsApi
      .list(buildParams(1))
      .then((data) => {
        if (ignore) return;
        setProducts(data.items);
        setTotal(data.total);
      })
      .catch(() => {
        if (ignore) return;
        setProducts([]);
        setTotal(0);
      });
    return () => {
      ignore = true;
    };
  }, [category, searchTerm, sort, minPrice, maxPrice, inStock]);

  const loadMore = async () => {
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const data = await productsApi.list(buildParams(nextPage));
      setProducts((prev) => [...(prev || []), ...data.items]);
      setTotal(data.total);
      setPage(nextPage);
    } finally {
      setLoadingMore(false);
    }
  };

  const updateParam = (key, value, omitWhen) => {
    const next = new URLSearchParams(searchParams);
    if (value && value !== omitWhen) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  const applyFilters = ({ minPrice: min, maxPrice: max, inStock: stock }) => {
    const next = new URLSearchParams(searchParams);
    const setOrDelete = (key, value) => (value ? next.set(key, value) : next.delete(key));
    setOrDelete('minPrice', String(min || '').trim());
    setOrDelete('maxPrice', String(max || '').trim());
    setOrDelete('inStock', stock ? 'true' : '');
    setSearchParams(next);
  };

  const submitSearch = (e) => {
    e.preventDefault();
    updateParam('search', search.trim());
  };

  const hasMore = products && products.length < total;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Fil d'Ariane */}
      <nav aria-label="Fil d'Ariane" className="mb-4 flex flex-wrap items-center gap-1 text-sm text-ink/50">
        <Link to="/" className="hover:text-ink">Accueil</Link>
        <ChevronRight size={14} />
        {currentCategory ? (
          <>
            <button onClick={() => updateParam('category', '')} className="hover:text-ink">Produits</button>
            <ChevronRight size={14} />
            <span className="font-medium text-ink">{currentCategory.name}</span>
          </>
        ) : (
          <span className="font-medium text-ink">Produits</span>
        )}
      </nav>

      {currentCategory ? (
        <div className="relative overflow-hidden rounded-xl2 bg-pine-900">
          <img src={bannerImage(currentCategory.slug)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
          <div className="absolute inset-0 bg-gradient-to-r from-pine-950 via-pine-950/80 to-transparent" />
          <div className="relative px-6 py-9 sm:px-10 sm:py-12">
            <h1 className="font-display text-3xl font-extrabold text-white sm:text-4xl">{currentCategory.name}</h1>
            {currentCategory.description && <p className="mt-2 max-w-xl text-white/70">{currentCategory.description}</p>}
          </div>
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-bold sm:text-3xl">Nos produits</h1>
          <p className="mt-1 text-ink/60">Silures frais et alevins, prix dégressif selon la quantité.</p>
        </>
      )}

      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => updateParam('category', '')}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              !category ? 'bg-pine-900 text-white' : 'bg-mist text-ink/70 hover:bg-line'
            }`}
          >
            Tous
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => updateParam('category', c.slug)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                category === c.slug ? 'bg-pine-900 text-white' : 'bg-mist text-ink/70 hover:bg-line'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <form onSubmit={submitSearch} className="flex w-full items-center gap-2 rounded-full border border-line bg-white px-4 py-2 sm:max-w-xs">
            <Search size={16} className="text-ink/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un produit..."
              aria-label="Rechercher un produit"
              className="w-full border-0 bg-transparent text-sm focus:outline-none"
            />
          </form>

          <FilterPanel minPrice={minPrice} maxPrice={maxPrice} inStock={inStock} onApply={applyFilters} />

          <label className="flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm">
            <ArrowUpDown size={15} className="text-ink/40" />
            <span className="sr-only">Trier par</span>
            <select
              value={sort}
              onChange={(e) => updateParam('sort', e.target.value, 'relevance')}
              className="cursor-pointer border-0 bg-transparent pr-1 text-sm font-medium text-ink focus:outline-none"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {searchTerm && (
        <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink/60">
          Résultats pour <strong className="text-ink">« {searchTerm} »</strong>
          <button onClick={() => updateParam('search', '')} className="inline-flex items-center gap-1 rounded-full bg-mist px-2.5 py-1 text-xs font-semibold text-ink/70 hover:bg-line">
            <X size={12} /> Effacer
          </button>
        </p>
      )}

      <div className="mt-6">
        {products === null ? (
          <ProductGridSkeleton />
        ) : products.length === 0 ? (
          <EmptyState
            icon={Fish}
            title="Aucun produit trouvé"
            description="Essayez une autre catégorie ou un autre mot-clé."
          />
        ) : (
          <>
            <p className="mb-4 text-sm text-ink/50" aria-live="polite">
              {total} produit{total > 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
              {products.map((p, i) => (
                <div key={p.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i % PAGE_SIZE, 8) * 40}ms` }}>
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
            {hasMore && (
              <div className="mt-10 text-center">
                <button onClick={loadMore} disabled={loadingMore} className="btn-secondary">
                  {loadingMore ? 'Chargement...' : `Voir plus (${total - products.length} restants)`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
