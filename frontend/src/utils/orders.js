// Aides d'affichage des commandes dans l'administration (listes, tableau de bord, fiche commande).

/** Nom du client : compte client, sinon invité, sinon destinataire de l'adresse. */
export function orderCustomerName(order) {
  const user = order?.customer?.user;
  if (user) return `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Client';
  return order?.guestName || order?.address?.fullName || 'Client';
}

/** Téléphone à joindre : celui du compte, sinon de l'invité, sinon de l'adresse de livraison. */
export function orderCustomerPhone(order) {
  return order?.customer?.user?.phone || order?.guestPhone || order?.address?.phone || '';
}

/** « Essos · Zone Centre » : où va la commande (quartier + zone), pour une ligne de liste. */
export function orderPlace(order) {
  return [order?.address?.district, order?.deliveryZone?.name].filter(Boolean).join(' · ');
}

/** Commande annulée alors que l'argent avait déjà été encaissé : il reste à rembourser le client. */
export const needsRefund = (order) => order?.status === 'CANCELLED' && order?.payment?.status === 'PAID';

// Prochains statuts que l'administrateur peut choisir depuis chaque statut (mêmes transitions que le serveur,
// l'annulation ayant son propre bouton). « Assignée » demande un livreur ; le passage à « Prête » ou « Assignée »
// peut en désigner un en même temps.
export const NEXT_STATUSES = {
  PENDING: ['CONFIRMED'],
  CONFIRMED: ['PREPARING'],
  PREPARING: ['READY'],
  READY: ['ASSIGNED'],
  ASSIGNED: ['PICKED_UP'],
  PICKED_UP: ['ON_DELIVERY'],
  ON_DELIVERY: ['DELIVERED'],
};

const ASSIGNABLE_STATUSES = ['CONFIRMED', 'PREPARING', 'READY', 'ASSIGNED'];

/**
 * Un livreur peut être (ré)assigné tant que la commande n'est pas partie, et aussi après un problème
 * signalé par le livreur (livraison « non livrée ») pour relancer la livraison — même règle que le serveur.
 */
export function canAssignDriver(order) {
  if (!order) return false;
  if (ASSIGNABLE_STATUSES.includes(order.status)) return true;
  return order.delivery?.status === 'FAILED' && !['DELIVERED', 'CANCELLED'].includes(order.status);
}

/** Statuts qui acceptent un livreur choisi en même temps que le changement de statut. */
export const STATUSES_WITH_DRIVER = ['READY', 'ASSIGNED'];

export const ACTIVE_ORDER_STATUSES = ['CONFIRMED', 'PREPARING', 'READY', 'ASSIGNED', 'PICKED_UP', 'ON_DELIVERY'];
