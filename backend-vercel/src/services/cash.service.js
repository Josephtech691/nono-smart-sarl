const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');

// Regle metier : le paiement en especes n'est propose qu'a un client AYANT UN COMPTE et qui a deja
// PAYE PLUS DE 2 commandes via un operateur mobile (MTN Mobile Money / Orange Money), donc au moins 3.
const MOBILE_PAID_ORDERS_THRESHOLD = 2; // « plus de 2 » : strictement superieur
const MOBILE_METHODS = ['MTN_MOMO', 'ORANGE_MONEY'];

async function cashEligibility(customerId) {
  const required = MOBILE_PAID_ORDERS_THRESHOLD + 1;
  if (!customerId) {
    return { hasAccount: false, eligible: false, reason: 'NO_ACCOUNT', paidMobileOrders: 0, required, remaining: required };
  }
  // Seuls comptent les paiements mobiles effectivement encaisses (PAID) sur des commandes non annulees.
  const paidMobileOrders = await prisma.payment.count({
    where: { status: 'PAID', method: { in: MOBILE_METHODS }, order: { customerId, status: { not: 'CANCELLED' } } },
  });
  const eligible = paidMobileOrders > MOBILE_PAID_ORDERS_THRESHOLD;
  return {
    hasAccount: true,
    eligible,
    reason: eligible ? null : 'NOT_ENOUGH_MOBILE_ORDERS',
    paidMobileOrders,
    required,
    remaining: Math.max(0, required - paidMobileOrders),
  };
}

// Leve une erreur 403 si le client ne peut pas payer en especes.
async function assertCashAllowed(customerId) {
  const state = await cashEligibility(customerId);
  if (state.eligible) return state;
  const message = !state.hasAccount
    ? 'Le paiement en espèces est réservé aux clients ayant un compte. Payez par MTN Mobile Money ou Orange Money, ou créez un compte.'
    : `Le paiement en espèces est disponible après ${state.required} commandes payées par Mobile Money (il vous en reste ${state.remaining}).`;
  throw new ApiError(403, message, { code: 'CASH_NOT_ALLOWED', ...state });
}

module.exports = { cashEligibility, assertCashAllowed, MOBILE_PAID_ORDERS_THRESHOLD };
