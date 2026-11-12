import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, ArrowRight } from 'lucide-react';
import { ordersApi } from '../../api/orders';
import { reviewsApi } from '../../api/extras';
import AccountBack from '../../components/AccountBack';
import ReviewScores, { averageScore } from '../../components/ReviewScores';
import EmptyState from '../../components/EmptyState';
import { RowSkeleton } from '../../components/Skeleton';
import usePageMeta from '../../utils/usePageMeta';
import { formatDate } from '../../utils/format';

const formatAverage = (review) => averageScore(review).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function MyReviews() {
  usePageMeta('Mes avis');
  const [reviews, setReviews] = useState(null);
  const [toReview, setToReview] = useState([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let ignore = false;
    Promise.allSettled([reviewsApi.mine(), ordersApi.list({ status: 'DELIVERED', limit: 100 })]).then(([mine, delivered]) => {
      if (ignore) return;
      setReviews(mine.status === 'fulfilled' && Array.isArray(mine.value) ? mine.value : []);
      setToReview(delivered.status === 'fulfilled' ? (delivered.value.items || []).filter((o) => !o.review) : []);
      setFailed(mine.status === 'rejected');
    });
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Mes avis</h1>
      <AccountBack />

      {reviews === null ? (
        <RowSkeleton count={3} />
      ) : (
        <div className="space-y-8">
          {failed && (
            <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Impossible de charger vos avis pour le moment. Réessayez dans un instant.
            </p>
          )}

          {toReview.length > 0 && (
            <section aria-labelledby="to-review-title">
              <h2 id="to-review-title" className="mb-3 font-display text-lg font-semibold">À évaluer ({toReview.length})</h2>
              <div className="space-y-3">
                {toReview.map((o) => (
                  <div key={o.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-display font-semibold text-ink">{o.orderNumber}</p>
                      <p className="mt-0.5 truncate text-xs text-ink/50">
                        Livrée · {formatDate(o.createdAt)} · {(o.items || []).map((i) => i.name).slice(0, 2).join(', ')}
                      </p>
                    </div>
                    <Link to={`/compte/commandes/${o.id}`} className="btn-primary shrink-0 !px-4 !py-2 text-sm">
                      <Star size={15} /> Donner mon avis
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="my-reviews-title">
            <h2 id="my-reviews-title" className="mb-3 font-display text-lg font-semibold">
              Mes avis{reviews.length > 0 ? ` (${reviews.length})` : ''}
            </h2>
            {reviews.length === 0 ? (
              <EmptyState
                icon={Star}
                title="Aucun avis pour le moment"
                description="Après une livraison, vous pourrez noter la qualité des produits, la livraison et notre service."
                action={<Link to="/compte/commandes" className="btn-secondary mt-2">Voir mes commandes</Link>}
              />
            ) : (
              <div className="space-y-3">
                {reviews.map((r) => (
                  <article key={r.id} className="card p-5">
                    <header className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          to={r.order?.id ? `/compte/commandes/${r.order.id}` : '/compte/commandes'}
                          className="font-display font-semibold text-ink hover:text-brand-700"
                        >
                          {r.order?.orderNumber || 'Commande'}
                        </Link>
                        <p className="mt-0.5 text-xs text-ink/50">
                          {formatDate(r.createdAt)}
                          {r.product?.name && (
                            <>
                              {' · '}
                              {r.product.slug ? (
                                <Link to={`/produits/${r.product.slug}`} className="hover:underline">{r.product.name}</Link>
                              ) : (
                                r.product.name
                              )}
                            </>
                          )}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-sm font-semibold text-amber-700">
                        <Star size={14} className="fill-amber-400 text-amber-400" /> {formatAverage(r)} / 5
                      </span>
                    </header>

                    <div className="mt-4">
                      <ReviewScores review={r} />
                    </div>

                    {r.comment && <p className="mt-4 rounded-lg bg-mist px-3 py-2.5 text-sm italic text-ink/70">« {r.comment} »</p>}
                    {r.isVisible === false && (
                      <p className="mt-3 text-xs text-ink/50">Cet avis n'est pas affiché publiquement sur le site.</p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <p className="text-center text-xs text-ink/45">
            Vos notes nous aident à améliorer la fraîcheur, la ponctualité et le service.{' '}
            <Link to="/compte/commandes" className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
              Mes commandes <ArrowRight size={12} />
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
