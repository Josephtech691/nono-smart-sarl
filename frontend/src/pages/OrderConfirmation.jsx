import { useEffect, useRef, useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { CheckCircle2, Loader2, KeyRound, Smartphone, FileDown } from 'lucide-react';
import { ordersApi, paymentsApi, downloadInvoice, downloadInvoiceByTracking } from '../api/orders';
import StatusTimeline from '../components/StatusTimeline';
import LiveDeliveryMap from '../components/LiveDeliveryMap';
import Loader from '../components/Loader';
import { toast } from '../store/toastStore';
import { formatFCFA, PAYMENT_METHOD_LABELS } from '../utils/format';

const LIVE_STATUSES = ['ASSIGNED', 'PICKED_UP', 'ON_DELIVERY'];

export default function OrderConfirmation() {
  const { id } = useParams();
  const location = useLocation();
  const [order, setOrder] = useState(location.state?.order || null);
  const [error, setError] = useState('');
  const paymentPollRef = useRef(null);
  const livePollRef = useRef(null);

  useEffect(() => {
    if (order) return;
    ordersApi
      .get(id)
      .then(setOrder)
      .catch(async () => {
        const cached = sessionStorage.getItem('lastOrder');
        if (cached) {
          try {
            const { orderNumber, phone } = JSON.parse(cached);
            const tracked = await ordersApi.track(orderNumber, phone);
            return setOrder(tracked);
          } catch (e) {
            // tombe dans le message d'erreur ci-dessous
          }
        }
        setError("Impossible d'afficher cette commande directement. Utilisez le suivi de commande avec votre numéro et votre téléphone.");
      });
  }, [id, order]);

  // Sondage du statut de paiement Mobile Money jusqu'à confirmation
  useEffect(() => {
    if (!order || order.payment?.method === 'CASH' || order.payment?.status === 'PAID') return;

    paymentPollRef.current = setInterval(async () => {
      try {
        const { status } = await paymentsApi.status(order.id);
        if (status !== order.payment.status) {
          const fresh = await ordersApi.get(order.id).catch(() => null);
          if (fresh) setOrder(fresh);
          else setOrder((o) => ({ ...o, payment: { ...o.payment, status } }));
        }
      } catch (e) {
        // silencieux : on réessaiera au prochain intervalle
      }
    }, 3000);

    return () => clearInterval(paymentPollRef.current);
  }, [order]);

  // Rafraichit la commande pendant la livraison pour suivre la position du
  // livreur et les changements de statut en direct (section 75).
  useEffect(() => {
    if (!order || !LIVE_STATUSES.includes(order.status)) return;

    livePollRef.current = setInterval(async () => {
      const fresh = await ordersApi.get(order.id).catch(() => null);
      if (fresh) setOrder(fresh);
    }, 10000);

    return () => clearInterval(livePollRef.current);
  }, [order?.status, order?.id]);

  const handleSimulate = async () => {
    await paymentsApi.simulate(order.id);
    const fresh = await ordersApi.get(order.id).catch(() => null);
    if (fresh) setOrder(fresh);
  };

  const handleInvoice = async () => {
    try {
      if (order.customerId) await downloadInvoice(order.id, order.orderNumber);
      else await downloadInvoiceByTracking(order.orderNumber, order.guestPhone);
    } catch (e) {
      toast.error('Facture indisponible pour le moment');
    }
  };

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center sm:px-6">
        <p className="text-ink/70">{error}</p>
        <Link to="/suivi-commande" className="btn-primary mt-5 inline-flex">Suivre ma commande</Link>
      </div>
    );
  }

  if (!order) return <Loader label="Chargement de votre commande..." />;

  const isMomo = order.payment?.method === 'MTN_MOMO' || order.payment?.method === 'ORANGE_MONEY';
  const waitingPayment = isMomo && order.payment?.status !== 'PAID';

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="flex flex-col items-center text-center animate-fade-up">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-500/15 text-brand-700">
          <CheckCircle2 size={32} />
        </span>
        <h1 className="mt-4 text-2xl font-bold sm:text-3xl">Commande enregistrée !</h1>
        <p className="mt-1 text-ink/60">Numéro de commande</p>
        <p className="font-display text-xl font-bold text-pine-900">{order.orderNumber}</p>
      </div>

      {waitingPayment && (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-xl2 border border-amber-200 bg-amber-50 p-6 text-center">
          <Smartphone size={26} className="text-amber-600" />
          <p className="font-medium text-amber-800">
            Validez la demande de paiement {PAYMENT_METHOD_LABELS[order.payment.method]} reçue sur votre téléphone.
          </p>
          <p className="flex items-center gap-2 text-sm text-amber-700">
            <Loader2 size={14} className="animate-spin" /> En attente de confirmation...
          </p>
          {import.meta.env.DEV && (
            <button onClick={handleSimulate} className="btn-secondary !py-1.5 text-xs">
              Simuler la confirmation (dev)
            </button>
          )}
        </div>
      )}

      {order.delivery?.confirmationCode && order.status !== 'DELIVERED' && (
        <div className="mt-6 flex items-center justify-center gap-3 rounded-xl2 border border-line bg-mist/60 px-5 py-4">
          <KeyRound size={20} className="text-pine-800" />
          <p className="text-sm text-ink/70">
            Code de confirmation à donner au livreur : <span className="font-display text-lg font-bold text-ink">{order.delivery.confirmationCode}</span>
          </p>
        </div>
      )}

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="mb-4 font-display font-semibold">Suivi de la commande</h2>
            <StatusTimeline status={order.status} />
          </div>
          <LiveDeliveryMap order={order} />
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="mb-3 font-display font-semibold">Détails</h2>
            <ul className="space-y-1.5 text-sm text-ink/70">
              {order.items.map((it) => (
                <li key={it.id} className="flex justify-between">
                  <span>{it.name} × {it.quantity}</span>
                  <span>{formatFCFA(it.total)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between text-ink/60"><span>Sous-total</span><span>{formatFCFA(order.subtotal)}</span></div>
              <div className="flex justify-between text-ink/60"><span>Livraison</span><span>{formatFCFA(order.deliveryFee)}</span></div>
              {order.discount > 0 && <div className="flex justify-between text-brand-700"><span>Réduction</span><span>-{formatFCFA(order.discount)}</span></div>}
              <div className="flex justify-between border-t border-line pt-2 font-display font-bold text-ink"><span>Total</span><span>{formatFCFA(order.total)}</span></div>
            </div>
            <button onClick={handleInvoice} className="btn-secondary mt-4 w-full !py-2 text-sm">
              <FileDown size={15} /> Télécharger la facture (PDF)
            </button>
          </div>
          <div className="card p-5 text-sm text-ink/70">
            <h2 className="mb-2 font-display font-semibold text-ink">Livraison</h2>
            <p>{order.address?.district}{order.address?.landmark ? ` — ${order.address.landmark}` : ''}</p>
            <p className="mt-1 text-ink/50">Paiement : {PAYMENT_METHOD_LABELS[order.payment?.method]}</p>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-center gap-3">
        <Link to="/produits" className="btn-secondary">Continuer mes achats</Link>
        <Link to="/suivi-commande" className="btn-primary">Suivre ma commande</Link>
      </div>
    </div>
  );
}
