import { PAYMENT_STATUS_LABELS } from '../utils/format';

const STYLES = {
  PENDING: 'bg-amber-100 text-amber-800',
  PROCESSING: 'bg-sky-100 text-sky-800',
  PAID: 'bg-brand-500/15 text-brand-700',
  FAILED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-red-100 text-red-700',
  REFUNDED: 'bg-violet-100 text-violet-800',
};

/**
 * Pastille de statut de paiement. Pour un paiement en especes, "En attente"
 * veut simplement dire "a regler a la livraison".
 */
export default function PaymentBadge({ status, method }) {
  const label = status === 'PENDING' && method === 'CASH' ? 'À payer à la livraison' : PAYMENT_STATUS_LABELS[status] || status || '—';
  return <span className={`badge ${STYLES[status] || 'bg-mist text-ink/70'}`}>{label}</span>;
}
