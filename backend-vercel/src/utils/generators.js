// Genere un numero de commande du type CMD-20260810-0001
function generateOrderNumber(sequence) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const seq = String(sequence).padStart(4, '0');
  return `CMD-${y}${m}${d}-${seq}`;
}

// Code de confirmation de livraison a 4 chiffres (section 38 du cahier des charges)
function generateDeliveryCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// Code de parrainage court et lisible (section 77, programme de parrainage)
function generateReferralCode(firstName = '') {
  const base = (firstName || 'ami').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}${rand}`;
}

function computeNextRunAt(frequency, from = new Date()) {
  const next = new Date(from);
  if (frequency === 'WEEKLY') next.setDate(next.getDate() + 7);
  else if (frequency === 'BIWEEKLY') next.setDate(next.getDate() + 14);
  else if (frequency === 'MONTHLY') next.setMonth(next.getMonth() + 1);
  return next;
}

module.exports = { generateOrderNumber, generateDeliveryCode, generateReferralCode, computeNextRunAt };
