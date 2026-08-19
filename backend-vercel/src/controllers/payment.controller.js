const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const mtnMomo = require('../integrations/mtnMomo');
const orangeMoney = require('../integrations/orangeMoney');
const { notifyAdmins, notify } = require('../utils/notify');

async function loadPayment(orderId) {
  const payment = await prisma.payment.findUnique({ where: { orderId }, include: { order: true } });
  if (!payment) throw new ApiError(404, 'Paiement introuvable pour cette commande');
  return payment;
}

// POST /api/payments/:orderId/mtn - initie le push USSD MTN Mobile Money
const initiateMtn = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { phoneNumber } = req.body;
  const payment = await loadPayment(orderId);

  if (payment.status === 'PAID') throw new ApiError(400, 'Cette commande est deja payee');
  if (payment.method !== 'MTN_MOMO') throw new ApiError(400, 'Le mode de paiement de cette commande n\'est pas MTN Mobile Money');

  const result = await mtnMomo.requestToPay({ amount: payment.amount, phoneNumber, externalId: payment.order.orderNumber });

  await prisma.$transaction([
    prisma.payment.update({ where: { id: payment.id }, data: { status: 'PROCESSING', phoneNumber, transactionRef: result.referenceId } }),
    prisma.paymentTransaction.create({ data: { paymentId: payment.id, provider: 'mtn_momo', status: result.status, rawResponse: result.raw } }),
  ]);

  res.json({ message: 'Paiement initie. Validez la demande recue sur votre telephone.', status: 'PROCESSING', reference: result.referenceId });
});

// POST /api/payments/:orderId/orange
const initiateOrange = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { phoneNumber } = req.body;
  const payment = await loadPayment(orderId);

  if (payment.status === 'PAID') throw new ApiError(400, 'Cette commande est deja payee');
  if (payment.method !== 'ORANGE_MONEY') throw new ApiError(400, "Le mode de paiement de cette commande n'est pas Orange Money");

  const result = await orangeMoney.initiatePayment({ amount: payment.amount, phoneNumber, externalId: payment.order.orderNumber });

  await prisma.$transaction([
    prisma.payment.update({ where: { id: payment.id }, data: { status: 'PROCESSING', phoneNumber, transactionRef: result.referenceId } }),
    prisma.paymentTransaction.create({ data: { paymentId: payment.id, provider: 'orange_money', status: result.status, rawResponse: result.raw } }),
  ]);

  res.json({ message: 'Paiement initie. Validez la demande recue sur votre telephone.', status: 'PROCESSING', reference: result.referenceId });
});

// GET /api/payments/:orderId/status - utilise par le frontend pour sonder
// l'etat du paiement pendant l'attente de confirmation Mobile Money
const getStatus = asyncHandler(async (req, res) => {
  const payment = await loadPayment(req.params.orderId);
  res.json({ status: payment.status, method: payment.method, amount: payment.amount });
});

// POST /api/payments/:orderId/simulate - AIDE AU DEVELOPPEMENT UNIQUEMENT.
// Permet de tester tout le tunnel (commande -> paiement -> confirmation) en
// local sans etre branche sur les vraies API MTN/Orange. Desactive en
// production et reserve aux administrateurs.
const simulateSuccess = asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    throw new ApiError(403, "Cette route n'est pas disponible en production");
  }
  const payment = await loadPayment(req.params.orderId);

  await prisma.$transaction([
    prisma.payment.update({ where: { id: payment.id }, data: { status: 'PAID' } }),
    prisma.order.update({ where: { id: payment.orderId }, data: { status: 'CONFIRMED' } }),
    prisma.orderStatusHistory.create({ data: { orderId: payment.orderId, status: 'CONFIRMED', note: 'Paiement confirme (simulation dev)' } }),
  ]);

  await notifyAdmins({ title: 'Paiement recu', message: payment.order.orderNumber, link: `/admin/orders/${payment.orderId}` });

  res.json({ status: 'PAID' });
});

module.exports = { initiateMtn, initiateOrange, getStatus, simulateSuccess };
