const prisma = require('../config/db');
const mtnMomo = require('../integrations/mtnMomo');
const orangeMoney = require('../integrations/orangeMoney');
const { notifyAdmins } = require('../utils/notify');

const OPEN_STATUSES = ['PENDING', 'PROCESSING'];

// Applique l'issue d'un paiement Mobile Money ('PAID' | 'FAILED'). Idempotent : seule la premiere
// confirmation (notification, interrogation ou simulation) a un effet, les suivantes sont ignorees.
async function settle(paymentId, outcome, { provider, note, raw } = {}) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
  if (!payment || !OPEN_STATUSES.includes(payment.status)) return { changed: false, status: payment?.status };
  if (payment.order.status === 'CANCELLED') return { changed: false, status: payment.status };

  const changed = await prisma.$transaction(async (tx) => {
    const res = await tx.payment.updateMany({ where: { id: paymentId, status: { in: OPEN_STATUSES } }, data: { status: outcome } });
    if (res.count === 0) return false; // deja traite par un autre appel
    await tx.paymentTransaction.create({ data: { paymentId, provider: provider || 'system', status: outcome, rawResponse: raw || {} } });
    if (outcome === 'PAID' && payment.order.status === 'PENDING') {
      await tx.order.update({ where: { id: payment.orderId }, data: { status: 'CONFIRMED' } });
      await tx.orderStatusHistory.create({ data: { orderId: payment.orderId, status: 'CONFIRMED', note: note || 'Paiement confirmé' } });
    }
    return true;
  });

  if (changed) {
    await notifyAdmins({
      title: outcome === 'PAID' ? 'Paiement reçu' : 'Paiement échoué',
      message: payment.order.orderNumber,
      link: `/admin/commandes/${payment.orderId}`,
    });
  }
  return { changed, status: changed ? outcome : (await prisma.payment.findUnique({ where: { id: paymentId } })).status };
}

async function latestTransaction(paymentId, provider) {
  return prisma.paymentTransaction.findFirst({ where: { paymentId, provider }, orderBy: { createdAt: 'desc' } });
}

// Interroge l'operateur pour un paiement « en cours » et enregistre le resultat. Ne leve jamais
// d'erreur : un operateur injoignable laisse simplement le paiement en cours.
async function refresh(payment) {
  if (payment.status !== 'PROCESSING' || !payment.transactionRef) return payment.status;
  try {
    let result;
    let provider;
    if (payment.method === 'MTN_MOMO') {
      provider = 'mtn_momo';
      result = await mtnMomo.getPaymentStatus(payment.transactionRef);
    } else if (payment.method === 'ORANGE_MONEY') {
      provider = 'orange_money';
      const last = await latestTransaction(payment.id, provider);
      const orderRef = last?.rawResponse?.orderRef;
      if (!orderRef) return payment.status;
      result = await orangeMoney.getPaymentStatus({ orderRef, amount: payment.amount, payToken: payment.transactionRef });
    } else {
      return payment.status;
    }
    if (result.status === 'PAID' || result.status === 'FAILED') {
      const outcome = await settle(payment.id, result.status, { provider, note: 'Paiement confirmé par l\'opérateur', raw: result.raw });
      return outcome.status;
    }
  } catch (err) {
    console.error('[payments] verification du statut impossible :', err.message);
  }
  return payment.status;
}

module.exports = { settle, refresh, latestTransaction };
