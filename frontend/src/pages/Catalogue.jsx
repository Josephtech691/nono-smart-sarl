import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Fish } from 'lucide-react';
import { productsApi, categoriesApi } from '../api/catalog';
import ProductCard from '../components/ProductCard';
import { ProductGridSkeleton } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

export default function Catalogue() {
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get('category') || '';
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState(null);

  useEffect(() => {
    categoriesApi.list().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    setProducts(null);
    const params = {};
    if (category) params.category = category;
    if (searchParams.get('search')) params.search = searchParams.get('search');
    productsApi
      .list(params)
      .then((data) => setProducts(data.items))
      .catch(() => setProducts([]));
  }, [category, searchParams]);

  const applyCategory = (slug) => {
    const next = new URLSearchParams(searchParams);
    if (slug) next.set('category', slug);
    else next.delete('category');
    setSearchParams(next);
  };

  const submitSearch = (e) => {
    e.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (search) next.set('search', search);
    else next.delete('search');
    setSearchParams(next);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Nos produits</h1>
      <p className="mt-1 text-ink/60">Silures frais et alevins, prix dégressif selon la quantité.</p>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => applyCategory('')}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              !category ? 'bg-pine-900 text-white' : 'bg-mist text-ink/70 hover:bg-line'
            }`}
          >
            Tous
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => applyCategory(c.slug)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                category === c.slug ? 'bg-pine-900 text-white' : 'bg-mist text-ink/70 hover:bg-line'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <form onSubmit={submitSearch} className="flex w-full max-w-xs items-center gap-2 rounded-full border border-line bg-white px-4 py-2">
          <Search size={16} className="text-ink/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un produit..."
            className="w-full border-0 bg-transparent text-sm focus:outline-none"
          />
        </form>
      </div>

      <div className="mt-8">
        {products === null ? (
          <ProductGridSkeleton />
        ) : products.length === 0 ? (
          <EmptyState
            icon={Fish}
            title="Aucun produit trouvé"
            description="Essayez une autre catégorie ou un autre mot-clé."
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p, i) => (
              <div key={p.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
