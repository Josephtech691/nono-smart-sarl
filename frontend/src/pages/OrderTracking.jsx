import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, KeyRound, FileDown } from 'lucide-react';
import { ordersApi, downloadInvoiceByTracking } from '../api/orders';
import StatusTimeline from '../components/StatusTimeline';
import LiveDeliveryMap from '../components/LiveDeliveryMap';
import ContactDriverButton from '../components/ContactDriverButton';
import NeedHelp from '../components/NeedHelp';
import PaymentBadge from '../components/PaymentBadge';
import usePageMeta from '../utils/usePageMeta';
import Loader from '../components/Loader';
import { toast } from '../store/toastStore';
import { formatFCFA, formatDate, PAYMENT_METHOD_LABELS } from '../utils/format';

const LIVE_STATUSES = ['ASSIGNED', 'PICKED_UP', 'ON_DELIVERY'];

export default function OrderTracking() {
  usePageMeta('Suivre ma commande');
  const { orderNumber: paramNumber } = useParams();
  const navigate = useNavigate();
  const [orderNumber, setOrderNumber] = useState(paramNumber || '');
  const [phone, setPhone] = useState('');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const livePollRef = useRef(null);

  const search = async (e) => {
    e?.preventDefault();
    setError('');
    setLoading(true);
    setOrder(null);
    try {
      const result = await ordersApi.track(orderNumber.trim(), phone.trim());
      setOrder(result);
      navigate(`/suivi-commande/${orderNumber.trim()}`, { replace: true });
    } catch (err) {
      setError(err.message || 'Commande introuvable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (paramNumber) setOrderNumber(paramNumber);
  }, [paramNumber]);

  useEffect(() => {
    if (!order || !LIVE_STATUSES.includes(order.status)) return;
    livePollRef.current = setInterval(async () => {
      try {
        const fresh = await ordersApi.track(orderNumber.trim(), phone.trim());
        setOrder(fresh);
      } catch (e) {
        // silencieux
      }
    }, 10000);
    return () => clearInterval(livePollRef.current);
  }, [order?.status]);

  const handleInvoice = async () => {
    try {
      await downloadInvoiceByTracking(order.orderNumber, phone.trim());
    } catch (e) {
      toast.error('Facture indisponible pour le moment');
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Suivre ma commande</h1>
      <p className="mt-1 text-ink/60">Entrez votre numéro de commande et votre téléphone.</p>

      <form onSubmit={search} className="card mt-6 grid gap-4 p-5 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="label">Numéro de commande</label>
          <input className="input" placeholder="CMD-20260810-0001" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} required />
        </div>
        <div>
          <label className="label">Téléphone</label>
          <input className="input" placeholder="6XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
        <button type="submit" className="btn-primary sm:col-span-3">
          <Search size={16} /> Rechercher
        </button>
      </form>

      {loading && <Loader />}
      {error && <p className="mt-4 text-center text-sm text-red-600">{error}</p>}

      {order && (
        <div className="mt-8 space-y-4">
          {order.delivery?.confirmationCode && order.status !== 'DELIVERED' && (
            <div className="flex items-center justify-center gap-3 rounded-xl2 border border-line bg-mist/60 px-5 py-4">
              <KeyRound size={20} className="text-pine-800" />
              <p className="text-sm text-ink/70">
                Code de confirmation : <span className="font-display text-lg font-bold text-ink">{order.delivery.confirmationCode}</span>
              </p>
            </div>
          )}
          <div className="card p-5">
            <h2 className="mb-4 font-display font-semibold">Statut</h2>
            <StatusTimeline status={order.status} />
          </div>
          <LiveDeliveryMap order={order} />
          <ContactDriverButton order={order} className="w-full" />
          <NeedHelp orderNumber={order.orderNumber} />
          <div className="card p-5 text-sm text-ink/70">
            <div className="flex justify-between"><span>Total</span><span className="font-semibold text-ink">{formatFCFA(order.total)}</span></div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span>Paiement</span>
              <span className="flex items-center gap-2">
                {PAYMENT_METHOD_LABELS[order.payment?.method]}
                <PaymentBadge status={order.payment?.status} method={order.payment?.method} />
              </span>
            </div>
            <div className="mt-2 flex justify-between gap-3"><span>Livraison</span><span className="text-right">{order.address?.district}{order.address?.landmark ? ` — ${order.address.landmark}` : ''}</span></div>
            {order.scheduledAt && (
              <div className="mt-2 flex justify-between gap-3"><span>Programmée</span><span className="text-right">{formatDate(order.scheduledAt)}</span></div>
            )}
            <button onClick={handleInvoice} className="btn-secondary mt-4 w-full !py-2 text-sm">
              <FileDown size={15} /> Télécharger la facture (PDF)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
