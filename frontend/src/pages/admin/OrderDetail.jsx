import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Phone, MapPin, KeyRound, Sparkles, FileDown } from 'lucide-react';
import { ordersApi, downloadInvoice } from '../../api/orders';
import { driversApi } from '../../api/logistics';
import LiveDeliveryMap from '../../components/LiveDeliveryMap';
import Loader from '../../components/Loader';
import StatusBadge from '../../components/StatusBadge';
import { toast } from '../../store/toastStore';
import { formatFCFA, formatDate, PAYMENT_METHOD_LABELS } from '../../utils/format';

// Doit rester synchronise avec backend/src/controllers/order.controller.js (VALID_TRANSITIONS)
const NEXT_STATUS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['CANCELLED'], // le passage a ASSIGNED se fait via "Assigner un livreur"
  ASSIGNED: ['CANCELLED'],
  PICKED_UP: ['ON_DELIVERY'],
  ON_DELIVERY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

const STATUS_ACTION_LABELS = {
  CONFIRMED: 'Confirmer',
  PREPARING: 'Passer en préparation',
  READY: 'Marquer prête',
  ON_DELIVERY: 'Marquer en livraison',
  DELIVERED: 'Marquer livrée',
  CANCELLED: 'Annuler',
};

export default function AdminOrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => ordersApi.get(id).then(setOrder);

  useEffect(() => {
    load();
    driversApi.list().then(setDrivers);
  }, [id]);

  const changeStatus = async (status) => {
    setBusy(true);
    try {
      await ordersApi.updateStatus(id, { status });
      toast.success(`Commande mise à jour : ${status}`);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const assignDriver = async () => {
    if (!selectedDriver) return;
    setBusy(true);
    try {
      await ordersApi.assignDriver(id, selectedDriver);
      toast.success('Livreur assigné');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const autoAssign = async () => {
    setBusy(true);
    try {
      await ordersApi.autoAssignDriver(id);
      toast.success('Livreur assigné automatiquement');
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleInvoice = async () => {
    try {
      await downloadInvoice(id, order.orderNumber);
    } catch (e) {
      toast.error('Facture indisponible');
    }
  };

  if (!order) return <Loader />;

  const customerName = order.customer ? `${order.customer.user.firstName} ${order.customer.user.lastName}` : order.guestName;
  const customerPhone = order.customer?.user?.phone || order.guestPhone;
  const availableDrivers = drivers.filter((d) => d.status !== 'SUSPENDED');

  return (
    <div>
      <Link to="/admin/commandes" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-ink/60 hover:text-ink">
        <ArrowLeft size={15} /> Toutes les commandes
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">{order.orderNumber}</h1>
          <p className="text-sm text-ink/50">{formatDate(order.createdAt)}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="card p-5">
            <h2 className="mb-3 font-display font-semibold">Articles</h2>
            <ul className="space-y-1.5 text-sm text-ink/70">
              {order.items.map((it) => (
                <li key={it.id} className="flex justify-between">
                  <span>{it.name} × {it.quantity} ({formatFCFA(it.unitPrice)}/u)</span>
                  <span className="font-medium text-ink">{formatFCFA(it.total)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between text-ink/60"><span>Sous-total</span><span>{formatFCFA(order.subtotal)}</span></div>
              <div className="flex justify-between text-ink/60"><span>Livraison ({order.deliveryZone?.name})</span><span>{formatFCFA(order.deliveryFee)}</span></div>
              {order.discount > 0 && <div className="flex justify-between text-brand-700"><span>Réduction</span><span>-{formatFCFA(order.discount)}</span></div>}
              <div className="flex justify-between border-t border-line pt-2 font-display font-bold text-ink"><span>Total</span><span>{formatFCFA(order.total)}</span></div>
            </div>
            <button onClick={handleInvoice} className="btn-secondary mt-3 !py-2 text-sm">
              <FileDown size={15} /> Télécharger la facture (PDF)
            </button>
          </div>

          <LiveDeliveryMap order={order} />

          <div className="card p-5">
            <h2 className="mb-3 font-display font-semibold">Actions</h2>
            <div className="flex flex-wrap gap-2">
              {(NEXT_STATUS[order.status] || []).map((s) => (
                <button
                  key={s}
                  disabled={busy}
                  onClick={() => changeStatus(s)}
                  className={s === 'CANCELLED' ? 'btn-secondary !border-red-300 !text-red-600 hover:!bg-red-50' : 'btn-primary'}
                >
                  {STATUS_ACTION_LABELS[s]}
                </button>
              ))}
              {order.status === 'READY' && (
                <div className="flex flex-wrap items-center gap-2">
                  <select value={selectedDriver} onChange={(e) => setSelectedDriver(e.target.value)} className="input !py-2 text-sm">
                    <option value="">Choisir un livreur...</option>
                    {availableDrivers.map((d) => <option key={d.id} value={d.id}>{d.user.firstName} {d.user.lastName} ({d.status})</option>)}
                  </select>
                  <button disabled={busy || !selectedDriver} onClick={assignDriver} className="btn-primary !py-2 text-sm">Assigner</button>
                  <button disabled={busy} onClick={autoAssign} className="btn-secondary !py-2 text-sm" title="Assigne automatiquement le livreur disponible le moins chargé">
                    <Sparkles size={14} /> Auto-assigner
                  </button>
                </div>
              )}
              {(NEXT_STATUS[order.status] || []).length === 0 && order.status !== 'READY' && (
                <p className="text-sm text-ink/40">Aucune action disponible pour ce statut.</p>
              )}
            </div>
          </div>

          {order.statusHistory?.length > 0 && (
            <div className="card p-5">
              <h2 className="mb-3 font-display font-semibold">Historique</h2>
              <ul className="space-y-2 text-sm">
                {order.statusHistory.map((h) => (
                  <li key={h.id} className="flex justify-between text-ink/60">
                    <span>{h.note || h.status}</span>
                    <span className="text-ink/40">{formatDate(h.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="mb-3 font-display font-semibold">Client</h2>
            <p className="text-sm font-medium text-ink">{customerName}</p>
            <a href={`tel:${customerPhone}`} className="mt-1 flex items-center gap-2 text-sm text-brand-700 hover:underline"><Phone size={14} /> {customerPhone}</a>
          </div>

          <div className="card p-5">
            <h2 className="mb-3 font-display font-semibold">Livraison</h2>
            <p className="flex items-start gap-2 text-sm text-ink/70"><MapPin size={15} className="mt-0.5 shrink-0" /> {order.address?.district}{order.address?.landmark ? ` — ${order.address.landmark}` : ''}</p>
            {order.address?.instructions && <p className="mt-1 text-xs italic text-ink/50">"{order.address.instructions}"</p>}
            {order.delivery?.confirmationCode && (
              <p className="mt-3 flex items-center gap-2 text-sm text-ink/70"><KeyRound size={15} /> Code : <span className="font-display font-bold text-ink">{order.delivery.confirmationCode}</span></p>
            )}
          </div>

          <div className="card p-5">
            <h2 className="mb-3 font-display font-semibold">Paiement</h2>
            <p className="text-sm text-ink/70">{PAYMENT_METHOD_LABELS[order.payment?.method]}</p>
            <p className="mt-1 text-xs text-ink/50">Statut : {order.payment?.status}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
