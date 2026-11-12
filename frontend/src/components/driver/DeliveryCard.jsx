import { Link } from 'react-router-dom';
import { MapPin, Phone, Clock } from 'lucide-react';
import {
  DELIVERY_STATUS_STYLES, deliveryStatusLabel, customerName, customerPhone, telHref,
  cashDue, paymentSummary, scheduledLabel,
} from '../../utils/delivery';
import { formatFCFA } from '../../utils/format';

export function DeliveryStatusBadge({ delivery }) {
  return <span className={`badge ${DELIVERY_STATUS_STYLES[delivery.status] || 'bg-mist text-ink/60'}`}>{deliveryStatusLabel(delivery)}</span>;
}

/** Carte d'une livraison à faire ou en cours (liste, « prochaine livraison »). */
export default function DeliveryCard({ delivery, cta = 'Voir la commande' }) {
  const { order } = delivery;
  const name = customerName(order);
  const tel = telHref(customerPhone(order));
  const due = cashDue(delivery);
  const pay = paymentSummary(order, delivery);
  const slot = scheduledLabel(order);
  const where = [order.address?.district, order.address?.landmark].filter(Boolean).join(' — ');

  return (
    <article className="card p-4" data-delivery={order.orderNumber}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display font-semibold text-ink">{order.orderNumber}</p>
          <p className="mt-0.5 truncate text-sm text-ink/70">{name}</p>
        </div>
        <DeliveryStatusBadge delivery={delivery} />
      </div>

      <p className="mt-2 flex items-start gap-1.5 text-sm text-ink/60">
        <MapPin size={15} className="mt-0.5 shrink-0" /> <span>{where || 'Adresse à confirmer'}</span>
      </p>
      {slot && (
        <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-ink/55">
          <Clock size={13} className="shrink-0" /> Souhaité : {slot}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
        <span className={pay.kind === 'unpaid' ? 'font-medium text-amber-700' : 'text-ink/55'}>{pay.label}</span>
        <span className="font-display font-bold text-ink">{due > 0 ? `À encaisser : ${formatFCFA(due)}` : formatFCFA(order.total)}</span>
      </div>

      <div className="mt-3 flex gap-2">
        <Link to={`/livreur/livraisons/${delivery.orderId}`} className="btn-primary flex-1 !py-2.5 text-sm">
          {cta}
        </Link>
        {tel && (
          <a href={tel} className="btn-secondary !px-4 !py-2.5" aria-label={`Appeler ${name}`}>
            <Phone size={17} />
          </a>
        )}
      </div>
    </article>
  );
}
