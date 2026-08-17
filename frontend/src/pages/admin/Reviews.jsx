import { useEffect, useState } from 'react';
import { EyeOff, Eye } from 'lucide-react';
import { reviewsApi } from '../../api/extras';
import Loader from '../../components/Loader';
import StarRating from '../../components/StarRating';
import { formatDate } from '../../utils/format';

export default function AdminReviews() {
  const [reviews, setReviews] = useState(null);

  const load = () => reviewsApi.list().then(setReviews);

  useEffect(() => { load(); }, []);

  const toggle = async (r) => {
    await reviewsApi.moderate(r.id, !r.isVisible);
    load();
  };

  if (reviews === null) return <Loader />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Avis clients</h1>
      <div className="mt-6 space-y-3">
        {reviews.length === 0 && <p className="text-ink/50">Aucun avis pour le moment.</p>}
        {reviews.map((r) => (
          <div key={r.id} className={`card p-4 ${!r.isVisible ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-ink">{r.customer?.user?.firstName} {r.customer?.user?.lastName}</p>
                <p className="text-xs text-ink/40">{formatDate(r.createdAt)}</p>
              </div>
              <button onClick={() => toggle(r)} className="flex h-8 w-8 items-center justify-center rounded-full text-ink/50 hover:bg-mist" title={r.isVisible ? 'Masquer' : 'Afficher'}>
                {r.isVisible ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <div className="mt-2 flex gap-4 text-xs text-ink/60">
              <span className="flex items-center gap-1">Qualité <StarRating value={r.quality} readOnly size={13} /></span>
              <span className="flex items-center gap-1">Livraison <StarRating value={r.delivery} readOnly size={13} /></span>
              <span className="flex items-center gap-1">Service <StarRating value={r.service} readOnly size={13} /></span>
            </div>
            {r.comment && <p className="mt-2 text-sm text-ink/70">{r.comment}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
