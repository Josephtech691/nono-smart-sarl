import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { favoritesApi } from '../../api/extras';
import AccountBack from '../../components/AccountBack';
import ProductCard from '../../components/ProductCard';
import EmptyState from '../../components/EmptyState';
import Loader from '../../components/Loader';

export default function Favorites() {
  const [favorites, setFavorites] = useState(null);

  useEffect(() => {
    favoritesApi.list().then(setFavorites).catch(() => setFavorites([]));
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Mes favoris</h1>
      <AccountBack />

      {favorites === null ? (
        <Loader />
      ) : favorites.length === 0 ? (
        <EmptyState icon={Heart} title="Aucun favori" description="Ajoutez des produits en favoris depuis leur fiche produit." />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {favorites.map((f) => (
            <ProductCard key={f.id} product={f.product} />
          ))}
        </div>
      )}
    </div>
  );
}
