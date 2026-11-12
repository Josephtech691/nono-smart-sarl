// Formatte un montant en FCFA avec espace comme separateur de milliers,
// a l'identique de la maquette fournie ("2 500 FCFA").
export function formatFCFA(amount) {
  const value = Math.round(Number(amount) || 0);
  return `${value.toLocaleString('fr-FR')} FCFA`;
}

export function formatQuantity(quantity, unit) {
  const q = Number(quantity);
  const rounded = Number.isInteger(q) ? String(q) : String(Number(q.toFixed(2))).replace('.', ',');
  if (unit === 'KILOGRAM') return `${rounded} kg`;
  if (unit === 'GRAM') return `${rounded} g`;
  return `${rounded}`;
}

// Numeros camerounais : 9 chiffres (6XXXXXXXX) -> format international 237XXXXXXXXX,
// utilise par les liens WhatsApp (wa.me exige le format international sans "+").
export function toInternationalPhone(phone, countryCode = '237') {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith(countryCode) && digits.length >= 11) return digits;
  if (digits.length === 9) return `${countryCode}${digits}`;
  return digits;
}

// Inverse : "+237 659 103 000" / "237659103000" / "6 59 10 30 00" -> "659103000"
// (format national a 9 chiffres, celui que l'on affiche dans les champs de saisie).
export function toLocalPhone(phone, countryCode = '237') {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith(countryCode) && digits.length === 9 + countryCode.length) digits = digits.slice(countryCode.length);
  return digits;
}

// Numéro camerounais lisible : « 699123456 » / « +237 699 12 34 56 » -> « 699 12 34 56 » (autres formats inchangés).
export function formatPhone(phone) {
  const local = toLocalPhone(phone);
  if (/^\d{9}$/.test(local)) return `${local.slice(0, 3)} ${local.slice(3, 5)} ${local.slice(5, 7)} ${local.slice(7)}`;
  return String(phone || '');
}

export function whatsappUrl(phone, text) {
  const number = toInternationalPhone(phone);
  if (!number) return null;
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
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

// « 07 nov., 14:32 » (heure de Douala) : date compacte pour les tableaux de l'administration.
export function formatShortDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  const day = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', timeZone: 'Africa/Douala' });
  const hour = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Douala' });
  return `${day}, ${hour}`;
}

// « 07 nov. 2026 » (jour de Douala, sans l'heure) : date d'inscription, d'échéance…
export function formatDay(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Douala' });
}

// Un compte créé avec Google sans téléphone saisi porte un numéro provisoire (« google-pending-… ») : ce n'est pas un vrai numéro.
export function isPendingPhone(phone) {
  return String(phone || '').startsWith('google-pending-');
}

// « à l'instant », « il y a 5 min », « il y a 3 h », « hier », « il y a 4 j », puis « 3 nov. ».
export function formatRelative(dateString, now = Date.now()) {
  const time = new Date(dateString).getTime();
  if (Number.isNaN(time)) return '';
  const minutes = Math.floor(Math.max(0, now - time) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} j`;
  return new Date(time).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Africa/Douala' });
}

// Jour de Douala au format AAAA-MM-JJ (valeur d'un <input type="date">), décalé de `offsetDays` jours.
export function doualaDay(offsetDays = 0, now = Date.now()) {
  return new Date(now + offsetDays * 86400000).toLocaleDateString('fr-CA', { timeZone: 'Africa/Douala' });
}

const formatNumber = (n) => (Number.isInteger(n) ? n : Number(n.toFixed(2))).toLocaleString('fr-FR');

// Stock affiché dans l'administration, avec son unité : « 120 kg », « 1 000 unités », « 3 lots de 50 ».
const STOCK_UNITS = {
  PIECE: ['unité', 'unités'],
  CUSTOM: ['unité', 'unités'],
  LOT: ['lot', 'lots'],
  UNIT_50: ['lot de 50', 'lots de 50'],
  UNIT_100: ['lot de 100', 'lots de 100'],
  UNIT_500: ['lot de 500', 'lots de 500'],
  UNIT_1000: ['lot de 1000', 'lots de 1000'],
};

export function formatStock(quantity, unit) {
  const q = Number(quantity) || 0;
  if (unit === 'KILOGRAM') return `${formatNumber(q)} kg`;
  if (unit === 'GRAM') return `${formatNumber(q)} g`;
  const [one, many] = STOCK_UNITS[unit] || STOCK_UNITS.CUSTOM;
  return `${formatNumber(q)} ${Math.abs(q) > 1 ? many : one}`;
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

// Libellés courts pour les tableaux et la légende du graphique.
export const PAYMENT_METHOD_SHORT_LABELS = {
  MTN_MOMO: 'MTN MoMo',
  ORANGE_MONEY: 'Orange Money',
  CASH: 'Espèces',
};

export const PAYMENT_STATUS_LABELS = {
  PENDING: 'En attente',
  PROCESSING: 'En cours de validation',
  PAID: 'Payé',
  FAILED: 'Échoué',
  CANCELLED: 'Annulé',
  REFUNDED: 'Remboursé',
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
