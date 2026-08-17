import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, KeyRound, Send } from 'lucide-react';
import { ordersApi } from '../../api/orders';
import StatusTimeline from '../../components/StatusTimeline';
import StarRating from '../../components/StarRating';
import Loader from '../../components/Loader';
import { formatFCFA, PAYMENT_METHOD_LABELS } from '../../utils/format';

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [review, setReview] = useState({ quality: 5, delivery: 5, service: 5, comment: '' });
  const [reviewSent, setReviewSent] = useState(false);
  const [reviewError, setReviewError] = useState('');

  useEffect(() => {
    ordersApi.get(id).then(setOrder);
  }, [id]);

  const submitReview = async () => {
    setReviewError('');
    try {
      await ordersApi.review(id, review);
      setReviewSent(true);
    } catch (err) {
      setReviewError(err.message);
    }
  };

  const cancelOrder = async () => {
    if (!confirm('Annuler cette commande ?')) return;
    const updated = await ordersApi.cancel(id);
    setOrder(updated);
  };

  if (!order) return <Loader />;

  const canCancel = ['PENDING', 'CONFIRMED'].includes(order.status);
  const canReview = order.status === 'DELIVERED' && !order.review;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link to="/compte/commandes" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-ink/60 hover:text-ink">
        <ArrowLeft size={15} /> Mes commandes
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
        {canCancel && (
          <button onClick={cancelOrder} className="text-sm font-medium text-red-600 hover:underline">
            Annuler la commande
          </button>
        )}
      </div>

      {order.delivery?.confirmationCode && order.status !== 'DELIVERED' && (
        <div className="mt-4 flex items-center gap-3 rounded-xl2 border border-line bg-mist/60 px-5 py-4">
          <KeyRound size={20} className="text-pine-800" />
          <p className="text-sm text-ink/70">
            Code de confirmation : <span className="font-display text-lg font-bold text-ink">{order.delivery.confirmationCode}</span>
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 font-display font-semibold">Suivi</h2>
          <StatusTimeline status={order.status} />
        </div>
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="mb-3 font-display font-semibold">Articles</h2>
            <ul className="space-y-1.5 text-sm text-ink/70">
              {order.items.map((it) => (
                <li key={it.id} className="flex justify-between">
                  <span>{it.name} × {it.quantity}</span>
                  <span>{formatFCFA(it.total)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t border-line pt-3 font-display font-bold text-ink">
              <span>Total</span><span>{formatFCFA(order.total)}</span>
            </div>
            <p className="mt-2 text-xs text-ink/50">Paiement : {PAYMENT_METHOD_LABELS[order.payment?.method]}</p>
          </div>
        </div>
      </div>

      {canReview && (
        <div className="card mt-6 p-5">
          <h2 className="font-display font-semibold">Comment s'est passée votre commande ?</h2>
          {reviewSent ? (
            <p className="mt-3 text-sm text-brand-700">Merci pour votre avis !</p>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink/70">Qualité des produits</span>
                <StarRating value={review.quality} onChange={(v) => setReview((r) => ({ ...r, quality: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink/70">Livraison</span>
                <StarRating value={review.delivery} onChange={(v) => setReview((r) => ({ ...r, delivery: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink/70">Service</span>
                <StarRating value={review.service} onChange={(v) => setReview((r) => ({ ...r, service: v }))} />
              </div>
              <textarea
                className="input"
                rows={3}
                placeholder="Un commentaire (facultatif)"
                value={review.comment}
                onChange={(e) => setReview((r) => ({ ...r, comment: e.target.value }))}
              />
              {reviewError && <p className="text-sm text-red-600">{reviewError}</p>}
              <button onClick={submitReview} className="btn-primary">
                <Send size={15} /> Envoyer mon avis
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
