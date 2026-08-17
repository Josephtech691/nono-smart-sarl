// Formatte un montant en FCFA avec espace comme separateur de milliers,
// a l'identique de la maquette fournie ("2 500 FCFA").
export function formatFCFA(amount) {
  const value = Math.round(Number(amount) || 0);
  return `${value.toLocaleString('fr-FR')} FCFA`;
}

export function formatQuantity(quantity, unit) {
  const q = Number(quantity);
  const rounded = Number.isInteger(q) ? q : q.toFixed(2).replace(/\.00$/, '');
  if (unit === 'KILOGRAM') return `${rounded} kg`;
  if (unit === 'GRAM') return `${rounded} g`;
  return `${rounded}`;
}

export function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const ORDER_STATUS_LABELS = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  PREPARING: 'En préparation',
  READY: 'Prête',
  ASSIGNED: 'Livreur assigné',
  PICKED_UP: 'Récupérée par le livreur',
  ON_DELIVERY: 'En cours de livraison',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
};

export const ORDER_STATUS_ORDER = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'ASSIGNED',
  'PICKED_UP',
  'ON_DELIVERY',
  'DELIVERED',
];

export const PAYMENT_METHOD_LABELS = {
  MTN_MOMO: 'MTN Mobile Money',
  ORANGE_MONEY: 'Orange Money',
  CASH: 'Espèces à la livraison',
};

export const UNIT_LABELS = {
  GRAM: 'g',
  KILOGRAM: 'kg',
  PIECE: 'pièce',
  LOT: 'lot',
  UNIT_50: 'lot de 50',
  UNIT_100: 'lot de 100',
  UNIT_500: 'lot de 500',
  UNIT_1000: 'lot de 1000',
  CUSTOM: 'unité',
};

export const FREQUENCY_LABELS = {
  WEEKLY: 'Chaque semaine',
  BIWEEKLY: 'Toutes les 2 semaines',
  MONTHLY: 'Chaque mois',
};

export const PROFESSIONAL_STATUS_LABELS = {
  NONE: 'Compte particulier',
  PENDING: 'Demande en attente',
  APPROVED: 'Compte professionnel',
  REJECTED: 'Demande refusée',
};
