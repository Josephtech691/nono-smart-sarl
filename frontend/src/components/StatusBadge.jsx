import { ORDER_STATUS_LABELS } from '../utils/format';

const STYLES = {
  PENDING: 'bg-amber-100 text-amber-800',
  CONFIRMED: 'bg-sky-100 text-sky-800',
  PREPARING: 'bg-sky-100 text-sky-800',
  READY: 'bg-violet-100 text-violet-800',
  ASSIGNED: 'bg-violet-100 text-violet-800',
  PICKED_UP: 'bg-indigo-100 text-indigo-800',
  ON_DELIVERY: 'bg-indigo-100 text-indigo-800',
  DELIVERED: 'bg-brand-500/15 text-brand-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

export default function StatusBadge({ status }) {
  return <span className={`badge ${STYLES[status] || 'bg-mist text-ink/70'}`}>{ORDER_STATUS_LABELS[status] || status}</span>;
}
