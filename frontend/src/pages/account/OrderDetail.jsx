import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, KeyRound, Send, CalendarDays, MapPin, Wallet, CalendarClock } from 'lucide-react';
import { ordersApi } from '../../api/orders';
import StatusTimeline from '../../components/StatusTimeline';
import StarRating from '../../components/StarRating';
import ReviewScores from '../../components/ReviewScores';
import ContactDriverButton from '../../components/ContactDriverButton';
import NeedHelp from '../../components/NeedHelp';
import PaymentBadge from '../../components/PaymentBadge';
import StatusBadge from '../../components/StatusBadge';
import usePageMeta from '../../utils/usePageMeta';
import { toast } from '../../store/toastStore';
import Loader from '../../components/Loader';
import { formatFCFA, formatDate, PAYMENT_METHOD_LABELS } from '../../utils/format';

export default function OrderDetail() {
  usePageMeta('Détail de commande');
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
      const created = await ordersApi.review(id, review);
      // On affiche tout de suite l'avis enregistré à la place du formulaire.
      setOrder((o) => (o ? { ...o, review: created } : o));
      setReviewSent(true);
      toast.success('Merci pour votre avis !');
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
  const payNeedsAttention =
    order.status !== 'CANCELLED' &&
    ['MTN_MOMO', 'ORANGE_MONEY'].includes(order.payment?.method) &&
    ['PENDING', 'PROCESSING', 'FAILED', 'CANCELLED'].includes(order.payment?.status);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link to="/compte/commandes" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-ink/60 hover:text-ink">
        <ArrowLeft size={15} /> Mes commandes
      </Link>

      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
          <StatusBadge status={order.status} />
        </div>
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

      <ContactDriverButton order={order} className="mt-4 w-full sm:w-auto" />

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
          </div>
          <div className="card space-y-3 p-5 text-sm text-ink/70">
            <h2 className="font-display font-semibold text-ink">Informations</h2>
            <p className="flex items-start gap-2.5">
              <CalendarDays size={16} className="mt-0.5 shrink-0 text-ink/40" />
              <span>Commandée le {formatDate(order.createdAt)}</span>
            </p>
            <p className="flex items-start gap-2.5">
              <MapPin size={16} className="mt-0.5 shrink-0 text-ink/40" />
              <span>{order.address?.district}{order.address?.landmark ? ` — ${order.address.landmark}` : ''}</span>
            </p>
            {order.scheduledAt && (
              <p className="flex items-start gap-2.5">
                <CalendarClock size={16} className="mt-0.5 shrink-0 text-ink/40" />
                <span>Livraison programmée : {formatDate(order.scheduledAt)}{order.notes ? ` · ${order.notes}` : ''}</span>
              </p>
            )}
            <p className="flex flex-wrap items-center gap-2.5">
              <Wallet size={16} className="shrink-0 text-ink/40" />
              <span>{PAYMENT_METHOD_LABELS[order.payment?.method]}</span>
              <PaymentBadge status={order.payment?.status} method={order.payment?.method} />
            </p>
            {order.payment?.transactionRef && (
              <p className="pl-[26px] text-xs text-ink/40">Réf. transaction : {order.payment.transactionRef}</p>
            )}
            {payNeedsAttention && (
              <Link to={`/commande-confirmee/${order.id}`} className="ml-[26px] inline-block text-sm font-semibold text-brand-700 hover:underline">
                Finaliser le paiement →
              </Link>
            )}
          </div>
        </div>
      </div>

      <NeedHelp orderNumber={order.orderNumber} className="mt-6" />

      {order.review && (
        <div className="card mt-6 p-5">
          <h2 className="font-display font-semibold">Votre avis</h2>
          <div className="mt-3">
            <ReviewScores review={order.review} />
          </div>
          {order.review.comment && (
            <p className="mt-3 rounded-lg bg-mist px-3 py-2.5 text-sm italic text-ink/70">« {order.review.comment} »</p>
          )}
        </div>
      )}

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
