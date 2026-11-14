const { isPendingPhone } = require('./phone');
const { formatDoualaDay, formatDoualaTime } = require('./time');

// Libelles francais des statuts (exports CSV, messages envoyes aux clients).
const ORDER_STATUS_LABELS = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  PREPARING: 'En préparation',
  READY: 'Prête',
  ASSIGNED: 'Assignée',
  PICKED_UP: 'Récupérée',
  ON_DELIVERY: 'En livraison',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
};

// Formulation pour une phrase adressee au client : « Votre commande CMD-... est <texte> ».
const ORDER_STATUS_SENTENCES = {
  CONFIRMED: 'confirmée',
  PREPARING: 'en préparation',
  READY: 'prête',
  ASSIGNED: 'confiée à un livreur',
  PICKED_UP: 'récupérée par le livreur',
  ON_DELIVERY: 'en cours de livraison',
  DELIVERED: 'livrée',
  CANCELLED: 'annulée',
};

const PAYMENT_METHOD_LABELS = {
  MTN_MOMO: 'MTN Mobile Money',
  ORANGE_MONEY: 'Orange Money',
  CASH: 'Espèces à la livraison',
};

const PAYMENT_STATUS_LABELS = {
  PENDING: 'En attente',
  PROCESSING: 'En cours',
  PAID: 'Payé',
  FAILED: 'Échoué',
  CANCELLED: 'Annulé',
  REFUNDED: 'Remboursé',
};

// Nom et telephone a afficher pour une commande : le compte client, sinon l'invite, sinon le
// destinataire de l'adresse. Un numero provisoire (compte Google sans telephone) n'est pas affiche.
function orderCustomer(order) {
  const user = order?.customer?.user;
  const accountName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '';
  const accountPhone = user?.phone && !isPendingPhone(user.phone) ? user.phone : '';
  return {
    name: accountName || order?.guestName || order?.address?.fullName || 'Client',
    phone: accountPhone || order?.guestPhone || order?.address?.phone || '',
  };
}

const slashDate = (date) => formatDoualaDay(date).split('-').reverse().join('/');

// « 28 500 FCFA » : espaces ordinaires (le format fr-FR de Node met des espaces insecables fines,
// qui forcent un SMS en Unicode et s'affichent mal sur certains telephones).
const fcfa = (amount) => `${String(Math.round(Number(amount) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`;

// ---------------------------------------------------------------------------
// CSV (Excel francophone : separateur « ; », BOM UTF-8 pour les accents)
// ---------------------------------------------------------------------------

function csvCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  let text = String(value);
  // Neutralise les formules (=, +, -, @) qu'Excel executerait dans une cellule de texte.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(header, rows) {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(';'));
  return `﻿${lines.join('\r\n')}\r\n`;
}

module.exports = {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_SENTENCES,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  orderCustomer,
  slashDate,
  fcfa,
  formatDoualaTime,
  csvCell,
  toCsv,
};
