import { toInternationalPhone, PAYMENT_METHOD_LABELS } from './format';

// ---------------------------------------------------------------------------
// Aides pour l'espace livreur (affichage des livraisons)
// ---------------------------------------------------------------------------

export const DELIVERY_STATUS_LABELS = {
  PENDING: 'En attente',
  ASSIGNED: 'À livrer',
  PICKED_UP: 'Récupérée',
  ON_ROUTE: 'En route',
  DELIVERED: 'Livrée',
  FAILED: 'Non livrée',
};

export const DELIVERY_STATUS_STYLES = {
  PENDING: 'bg-mist text-ink/60',
  ASSIGNED: 'bg-sky-100 text-sky-800',
  PICKED_UP: 'bg-amber-100 text-amber-800',
  ON_ROUTE: 'bg-amber-100 text-amber-800',
  DELIVERED: 'bg-brand-500/15 text-brand-700',
  FAILED: 'bg-red-100 text-red-700',
};

/** Onglet d'une livraison : à faire, en cours, ou terminée (livrée / sans suite). */
export function deliveryGroup(delivery) {
  if (['PENDING', 'ASSIGNED'].includes(delivery.status)) return 'todo';
  if (['PICKED_UP', 'ON_ROUTE'].includes(delivery.status)) return 'progress';
  return 'done';
}

/** Libellé affiché : une livraison « non livrée » d'une commande annulée s'appelle « Annulée ». */
export function deliveryStatusLabel(delivery) {
  if (delivery.status === 'FAILED' && delivery.order?.status === 'CANCELLED') return 'Annulée';
  return DELIVERY_STATUS_LABELS[delivery.status] || delivery.status;
}

export const customerName = (order) => order?.address?.fullName || order?.guestName || 'Client';
export const customerPhone = (order) => order?.address?.phone || order?.guestPhone || '';

export function initialsOf(name) {
  const letters = String(name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => (w[0] || '').toUpperCase())
    .join('');
  return letters || '?';
}

/** Lien d'appel : le « + » et l'indicatif fonctionnent aussi quand le livreur est hors du pays. */
export function telHref(phone) {
  const number = toInternationalPhone(phone);
  return number ? `tel:+${number}` : null;
}

/**
 * Montant à encaisser en espèces : 0 si la commande est payée par Mobile Money, ou si l'administration
 * a déjà enregistré le paiement (client qui a réglé à l'avance : rien à percevoir à la porte).
 */
export function cashDue(delivery) {
  const payment = delivery?.order?.payment;
  if (payment?.method !== 'CASH' || payment.status === 'PAID') return 0;
  return delivery.cashExpected ?? delivery.order.total ?? 0;
}

/**
 * Résumé du paiement vu par le livreur :
 *  - cash   : il doit encaisser le montant (ou, la livraison faite, il l'a encaissé) ;
 *  - paid   : déjà payé (Mobile Money confirmé, ou espèces réglées d'avance), rien à encaisser ;
 *  - unpaid : Mobile Money non confirmé (à signaler à l'administration avant de remettre la commande).
 * `delivery` sert à reconnaître des espèces encaissées par le livreur lui-même (paiement passé à « payé »
 * à la confirmation) : elles restent des espèces, pas un « déjà payé ».
 */
export function paymentSummary(order, delivery) {
  const payment = order?.payment;
  const method = PAYMENT_METHOD_LABELS[payment?.method] || 'Paiement';
  if (payment?.method === 'CASH') {
    const collectedByDriver = delivery?.cashReceived != null;
    if (payment.status === 'PAID' && !collectedByDriver) return { kind: 'paid', label: `Payé · ${method}` };
    return { kind: 'cash', label: 'Espèces à la livraison' };
  }
  if (payment?.status === 'PAID') return { kind: 'paid', label: `Payé · ${method}` };
  return { kind: 'unpaid', label: `${method} non confirmé` };
}

export function mapUrl(order) {
  const a = order?.address;
  if (a?.latitude != null && a?.longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${a.latitude},${a.longitude}`;
  }
  const where = [a?.landmark, a?.district, 'Yaoundé, Cameroun'].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(where)}`;
}

/** Créneau demandé par le client (« jeu. 6 nov., 08:00 »), ou null. */
export function scheduledLabel(order) {
  if (!order?.scheduledAt) return null;
  return new Date(order.scheduledAt).toLocaleString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Douala',
  });
}

const time = (d) => (d ? new Date(d).getTime() : Infinity);

// Les livraisons avec un créneau passent d'abord (le plus proche en premier), puis les plus anciennes.
const bySchedule = (a, b) => {
  const sa = time(a.order?.scheduledAt);
  const sb = time(b.order?.scheduledAt);
  if (sa !== sb) return sa < sb ? -1 : 1;
  return new Date(a.createdAt) - new Date(b.createdAt);
};

export const sortTodo = (list) => [...list].sort(bySchedule);

/** Livraison à mettre en avant : celle en cours, sinon la prochaine à faire. */
export function pickNextDelivery(active) {
  const inProgress = active.filter((d) => deliveryGroup(d) === 'progress');
  if (inProgress.length) return inProgress[0];
  return sortTodo(active.filter((d) => deliveryGroup(d) === 'todo'))[0] || null;
}

/** Date de fin d'une livraison terminée (pour l'historique). */
export const endedAt = (delivery) => delivery.deliveredAt || delivery.assignedAt || delivery.createdAt;

const DAY_OPTS = { timeZone: 'Africa/Douala' };
export const dayKey = (date) => new Date(date).toLocaleDateString('fr-CA', DAY_OPTS); // AAAA-MM-JJ

export function dayLabel(key) {
  const today = dayKey(new Date());
  const yesterday = dayKey(new Date(Date.now() - 24 * 3600 * 1000));
  if (key === today) return "Aujourd'hui";
  if (key === yesterday) return 'Hier';
  const label = new Date(`${key}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export const timeLabel = (date) => new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Douala' });
