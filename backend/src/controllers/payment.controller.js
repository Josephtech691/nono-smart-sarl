const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const mtnMomo = require('../integrations/mtnMomo');
const orangeMoney = require('../integrations/orangeMoney');
const paymentConfig = require('../config/payments');
const paymentService = require('../services/payment.service');
const { notifyAdmins, notify } = require('../utils/notify');
const { orderSearchWhere, createdAtRange, enumFilter, pagination } = require('../utils/orderSearch');
const { fcfa, orderCustomer } = require('../utils/orderView');
const { isPendingPhone } = require('../utils/phone');

const PAYMENT_METHODS = ['MTN_MOMO', 'ORANGE_MONEY', 'CASH'];
const PAYMENT_STATUSES = ['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED'];
const RETRYABLE = ['PENDING', 'PROCESSING', 'FAILED'];

async function loadPayment(orderId) {
  const payment = await prisma.payment.findUnique({ where: { orderId }, include: { order: true } });
  if (!payment) throw new ApiError(404, 'Paiement introuvable pour cette commande');
  return payment;
}

// Une commande annulee ne peut plus etre payee (le client verrait une demande Mobile Money pour rien).
function ensureOrderOpen(payment) {
  if (payment.status === 'CANCELLED' || payment.order.status === 'CANCELLED') {
    throw new ApiError(400, 'Cette commande a ete annulee');
  }
}

// GET /api/payments/config - environnement et etat des cles API (affiche par le frontend :
// bandeau « erreur de developpement » si des cles manquent, simulateur uniquement en developpement).
const getConfig = asyncHandler(async (req, res) => {
  res.json(paymentConfig.publicConfig());
});

// POST /api/payments/:orderId/mtn - initie la demande de paiement MTN Mobile Money (validation par code PIN)
const initiateMtn = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { phoneNumber } = req.body;
  const payment = await loadPayment(orderId);

  if (payment.status === 'PAID') throw new ApiError(400, 'Cette commande est deja payee');
  ensureOrderOpen(payment);
  if (payment.method !== 'MTN_MOMO') throw new ApiError(400, 'Le mode de paiement de cette commande n\'est pas MTN Mobile Money');
  if (!RETRYABLE.includes(payment.status)) throw new ApiError(400, 'Ce paiement ne peut plus etre relance');

  const msisdn = mtnMomo.toMsisdn(phoneNumber);
  const result = await mtnMomo.requestToPay({ amount: payment.amount, phoneNumber: msisdn, externalId: payment.order.orderNumber });

  await prisma.$transaction([
    prisma.payment.update({ where: { id: payment.id }, data: { status: 'PROCESSING', phoneNumber: msisdn, transactionRef: result.referenceId } }),
    prisma.paymentTransaction.create({ data: { paymentId: payment.id, provider: 'mtn_momo', status: result.status, rawResponse: result.raw } }),
  ]);

  res.json({
    message: 'Paiement initie. Validez la demande recue sur votre telephone.',
    status: 'PROCESSING',
    reference: result.referenceId,
    simulated: !!result.simulated,
  });
});

// POST /api/payments/:orderId/orange - initie le paiement Orange Money (redirection vers la page Orange)
const initiateOrange = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { phoneNumber } = req.body;
  const payment = await loadPayment(orderId);

  if (payment.status === 'PAID') throw new ApiError(400, 'Cette commande est deja payee');
  ensureOrderOpen(payment);
  if (payment.method !== 'ORANGE_MONEY') throw new ApiError(400, "Le mode de paiement de cette commande n'est pas Orange Money");
  if (!RETRYABLE.includes(payment.status)) throw new ApiError(400, 'Ce paiement ne peut plus etre relance');

  const phone = orangeMoney.toLocalPhone(phoneNumber);
  // Identifiant unique cote Orange : une nouvelle tentative utilise un nouveau suffixe.
  const attempts = await prisma.paymentTransaction.count({ where: { paymentId: payment.id, provider: 'orange_money' } });
  const orderRef = `${payment.order.orderNumber}-${attempts + 1}`.slice(0, 30);

  const result = await orangeMoney.initiatePayment({
    amount: payment.amount,
    phoneNumber: phone,
    externalId: payment.order.orderNumber,
    orderId: payment.orderId,
    orderRef,
  });

  await prisma.$transaction([
    prisma.payment.update({ where: { id: payment.id }, data: { status: 'PROCESSING', phoneNumber: phone, transactionRef: result.referenceId } }),
    prisma.paymentTransaction.create({ data: { paymentId: payment.id, provider: 'orange_money', status: result.status, rawResponse: result.raw } }),
  ]);

  res.json({
    message: result.paymentUrl
      ? 'Paiement initie. Vous allez etre redirige vers Orange Money pour le valider.'
      : 'Paiement initie (simulation).',
    status: 'PROCESSING',
    reference: result.referenceId,
    paymentUrl: result.paymentUrl || null,
    simulated: !!result.simulated,
  });
});

// GET /api/payments/:orderId/status - utilise par le frontend pour sonder l'etat du paiement. Pour un
// paiement en cours, l'operateur est interroge : le site n'a pas besoin d'attendre une notification.
const getStatus = asyncHandler(async (req, res) => {
  const payment = await loadPayment(req.params.orderId);
  const status = await paymentService.refresh(payment);
  res.json({ status, method: payment.method, amount: payment.amount });
});

// POST /api/payments/webhook/mtn - notification (callback) de MTN. Son contenu n'est jamais cru sur
// parole : on retrouve la commande puis on re-interroge MTN pour connaitre le vrai statut.
const mtnWebhook = asyncHandler(async (req, res) => {
  try {
    const externalId = String(req.body?.externalId || '');
    const order = externalId ? await prisma.order.findUnique({ where: { orderNumber: externalId }, include: { payment: true } }) : null;
    if (order?.payment && order.payment.method === 'MTN_MOMO') await paymentService.refresh(order.payment);
  } catch (err) {
    console.error('[payments] webhook MTN', err.message);
  }
  res.status(200).json({ received: true });
});

// POST /api/payments/webhook/orange/:orderId - notification d'Orange Money (notif_token verifie, puis
// statut confirme aupres d'Orange).
const orangeWebhook = asyncHandler(async (req, res) => {
  try {
    const payment = await prisma.payment.findUnique({ where: { orderId: req.params.orderId } });
    if (payment && payment.method === 'ORANGE_MONEY') {
      const last = await paymentService.latestTransaction(payment.id, 'orange_money');
      const expected = last?.rawResponse?.notifToken;
      if (expected && req.body?.notif_token === expected) await paymentService.refresh(payment);
      else console.warn('[payments] notification Orange ignoree (notif_token invalide)');
    }
  } catch (err) {
    console.error('[payments] webhook Orange', err.message);
  }
  res.status(200).json({ received: true });
});

// POST /api/payments/:orderId/simulate - SIMULATEUR : DEVELOPPEMENT UNIQUEMENT (introuvable en
// production, voir routes). Permet de tester tout le tunnel sans etre branche sur MTN / Orange.
//   body : { outcome: 'success' | 'failure' }  (success par defaut)
const simulate = asyncHandler(async (req, res) => {
  if (!paymentConfig.isDevelopment()) throw new ApiError(404, 'Route introuvable');
  const payment = await loadPayment(req.params.orderId);
  if (payment.method === 'CASH') throw new ApiError(400, "Le paiement en especes ne se simule pas");
  if (!['PENDING', 'PROCESSING'].includes(payment.status)) throw new ApiError(400, 'Ce paiement est deja traite');

  const outcome = req.body?.outcome === 'failure' ? 'FAILED' : 'PAID';
  const result = await paymentService.settle(payment.id, outcome, {
    provider: 'simulation_dev',
    note: outcome === 'PAID' ? 'Paiement confirme (simulation dev)' : 'Paiement refuse (simulation dev)',
    raw: { simulated: true },
  });
  res.json({ status: result.status });
});

// ---------------------------------------------------------------------------
// Administration des paiements
// ---------------------------------------------------------------------------

const PAYMENT_ROW_INCLUDE = {
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      total: true,
      createdAt: true,
      guestName: true,
      guestPhone: true,
      address: { select: { fullName: true, phone: true } },
      customer: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } },
      delivery: { select: { status: true, cashExpected: true, cashReceived: true, deliveredAt: true } },
    },
  },
};

// Une ligne de la page « Paiements » : le paiement + ce qu'il faut savoir de sa commande.
function paymentRow(payment) {
  const { order, ...rest } = payment;
  const customer = orderCustomer(order);
  return {
    ...rest,
    orderNumber: order.orderNumber,
    orderStatus: order.status,
    orderTotal: order.total,
    orderCreatedAt: order.createdAt,
    customerName: customer.name,
    customerPhone: customer.phone,
    delivery: order.delivery || null,
    // Encaisse puis commande annulee : l'argent doit etre rendu au client.
    refundDue: rest.status === 'PAID' && order.status === 'CANCELLED',
  };
}

async function paymentRowFor(orderId) {
  return paymentRow(await prisma.payment.findUnique({ where: { orderId }, include: PAYMENT_ROW_INCLUDE }));
}

// GET /api/payments (admin)
//   ?status=PENDING,PROCESSING   etat du paiement (liste possible)
//   ?view=refund                 paiements encaisses sur une commande annulee (a rembourser)
//   ?method=CASH|MTN_MOMO|ORANGE_MONEY  ?search=  ?from=AAAA-MM-JJ&to=AAAA-MM-JJ  ?page=&limit=
// `summary` (totaux par etat) tient compte du mode, de la periode et de la recherche, pas de l'etat.
const listPayments = asyncHandler(async (req, res) => {
  const { take, page, skip } = pagination(req.query);

  const base = {};
  const method = enumFilter(req.query.method, PAYMENT_METHODS, 'Mode de paiement invalide');
  if (method) base.method = method;
  const createdAt = createdAtRange(req.query.from, req.query.to);
  if (createdAt) base.createdAt = createdAt;
  const searchWhere = orderSearchWhere(req.query.search);
  const orderBase = searchWhere ? { AND: [searchWhere] } : {};
  if (searchWhere) base.order = orderBase;

  const refundWhere = { ...base, status: 'PAID', order: { ...orderBase, status: 'CANCELLED' } };
  let where = base;
  if (req.query.view === 'refund') {
    where = refundWhere;
  } else {
    const status = enumFilter(req.query.status, PAYMENT_STATUSES, 'Statut de paiement invalide');
    if (status) where = { ...base, status };
  }

  const [rows, total, grouped, refund] = await Promise.all([
    prisma.payment.findMany({ where, include: PAYMENT_ROW_INCLUDE, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take, skip }),
    prisma.payment.count({ where }),
    prisma.payment.groupBy({ by: ['status'], where: base, _count: { _all: true }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: refundWhere, _count: { _all: true }, _sum: { amount: true } }),
  ]);

  const sum = (...statuses) =>
    grouped
      .filter((g) => statuses.includes(g.status))
      .reduce((acc, g) => ({ count: acc.count + g._count._all, amount: acc.amount + (g._sum.amount || 0) }), { count: 0, amount: 0 });

  res.json({
    items: rows.map(paymentRow),
    total,
    page,
    limit: take,
    summary: {
      all: sum(...PAYMENT_STATUSES),
      pending: sum('PENDING', 'PROCESSING'),
      paid: sum('PAID'),
      failed: sum('FAILED'),
      cancelled: sum('CANCELLED'),
      refunded: sum('REFUNDED'),
      refundDue: { count: refund._count._all, amount: refund._sum.amount || 0 },
    },
  });
});

async function loadForAdmin(orderId) {
  const payment = await prisma.payment.findUnique({
    where: { orderId },
    include: { order: { include: { customer: { include: { user: { select: { id: true, phone: true } } } } } } },
  });
  if (!payment) throw new ApiError(404, 'Paiement introuvable pour cette commande');
  return payment;
}

const clean = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

// Prevenir le client (notification de son compte, SMS en plus pour un paiement Mobile Money).
function notifyCustomer(payment, { title, message, sms }) {
  const { order } = payment;
  const user = order.customer?.user;
  if (!user && !order.guestPhone) return Promise.resolve();
  return notify({
    userId: user?.id,
    audience: 'CUSTOMER',
    title,
    message,
    link: `/compte/commandes/${order.id}`,
    phone: user ? (isPendingPhone(user.phone) ? null : user.phone) : order.guestPhone,
    sms,
  });
}

// POST /api/payments/:orderId/mark-paid (admin)  { reference?, note? }
// Tant que MTN MoMo / Orange Money ne sont pas branches (aucune confirmation automatique), c'est
// l'administrateur qui constate le paiement (SMS de l'operateur, releve) et le saisit ici. Pour un
// paiement Mobile Money d'une commande encore « en attente », la commande passe a « confirmee ».
const markPaid = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const reference = clean(req.body?.reference, 80);
  const note = clean(req.body?.note, 200);

  const payment = await loadForAdmin(orderId);
  if (payment.status === 'PAID') throw new ApiError(400, 'Ce paiement est deja enregistre comme paye');
  if (payment.status === 'REFUNDED') throw new ApiError(400, 'Ce paiement a ete rembourse');
  if (payment.order.status === 'CANCELLED') throw new ApiError(400, "Commande annulee : impossible d'enregistrer un paiement");

  const confirmsOrder = payment.method !== 'CASH' && payment.order.status === 'PENDING';

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({ where: { id: payment.id }, data: { status: 'PAID', ...(reference ? { transactionRef: reference } : {}) } });
    await tx.paymentTransaction.create({
      data: {
        paymentId: payment.id,
        provider: 'manual_admin',
        status: 'PAID',
        rawResponse: { markedBy: req.user.id, markedByName: `${req.user.firstName} ${req.user.lastName}`, reference: reference || null, note: note || null },
      },
    });
    if (confirmsOrder) {
      await tx.order.update({ where: { id: orderId }, data: { status: 'CONFIRMED' } });
      await tx.orderStatusHistory.create({ data: { orderId, status: 'CONFIRMED', note: "Paiement confirme par l'administration" } });
    }
  });

  await notifyCustomer(payment, {
    title: 'Paiement reçu',
    message: `Nous avons bien reçu le paiement de votre commande ${payment.order.orderNumber} (${fcfa(payment.amount)}).`,
    sms: payment.method !== 'CASH',
  });

  res.json(await paymentRowFor(orderId));
});

// POST /api/payments/:orderId/mark-refunded (admin)  { reference?, note? }
// A utiliser une fois l'argent rendu au client (virement Mobile Money, remise d'especes) : l'application
// ne rembourse pas elle-meme, elle garde la trace. Reserve aux paiements encaisses d'une commande annulee.
const markRefunded = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const reference = clean(req.body?.reference, 80);
  const note = clean(req.body?.note, 200);

  const payment = await loadForAdmin(orderId);
  if (payment.status !== 'PAID') throw new ApiError(400, 'Seul un paiement encaisse peut etre rembourse');
  if (payment.order.status !== 'CANCELLED') throw new ApiError(400, "Annulez d'abord la commande avant de rembourser le client");

  await prisma.$transaction([
    prisma.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED' } }),
    prisma.paymentTransaction.create({
      data: {
        paymentId: payment.id,
        provider: 'manual_admin',
        status: 'REFUNDED',
        rawResponse: { markedBy: req.user.id, markedByName: `${req.user.firstName} ${req.user.lastName}`, reference: reference || null, note: note || null },
      },
    }),
  ]);

  await notifyCustomer(payment, {
    title: 'Remboursement effectué',
    message: `Votre commande ${payment.order.orderNumber} étant annulée, nous vous avons remboursé ${fcfa(payment.amount)}.`,
    sms: payment.method !== 'CASH',
  });

  res.json(await paymentRowFor(orderId));
});

module.exports = { getConfig, initiateMtn, initiateOrange, getStatus, mtnWebhook, orangeWebhook, simulate, listPayments, markPaid, markRefunded };
