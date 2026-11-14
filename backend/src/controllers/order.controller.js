const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const orderService = require('../services/order.service');
const cashService = require('../services/cash.service');
const { findBestDriver, performAssignment } = require('../utils/driverAssignment');
const { notify, notifyAdmins, notifyLowStock } = require('../utils/notify');
const { generateInvoicePdf } = require('../utils/generateInvoicePdf');
const { SAFE_USER_SELECT } = require('../utils/safeUser');
const { samePhone, isPendingPhone } = require('../utils/phone');
const { formatDoualaDay } = require('../utils/time');
const { orderSearchWhere, createdAtRange, enumFilter, pagination } = require('../utils/orderSearch');
const {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_SENTENCES,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  orderCustomer,
  slashDate,
  formatDoualaTime,
  toCsv,
} = require('../utils/orderView');

const FULL_INCLUDE = {
  items: true,
  address: true,
  deliveryZone: true,
  payment: true,
  delivery: {
    include: {
      driver: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } },
    },
  },
  coupon: true,
  // L'avis laisse par le client (null tant qu'il n'a pas note la livraison).
  review: true,
  statusHistory: { orderBy: { createdAt: 'asc' } },
  customer: { include: { user: { select: SAFE_USER_SELECT } } },
};

// Transitions de statut autorisees (section 25 du cahier des charges)
const VALID_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['ON_DELIVERY'],
  ON_DELIVERY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

// Une commande peut etre (re)assignee tant qu'elle n'est pas partie en livraison,
// OU apres un probleme signale par le livreur (livraison FAILED) pour relancer
// la livraison avec le meme livreur ou un autre - sinon l'admin serait bloque.
const ASSIGNABLE_STATUSES = ['READY', 'ASSIGNED', 'CONFIRMED', 'PREPARING'];
function canAssign(order, delivery) {
  if (ASSIGNABLE_STATUSES.includes(order.status)) return true;
  return delivery?.status === 'FAILED' && !['DELIVERED', 'CANCELLED'].includes(order.status);
}

// Onglets de la liste d'administration : « en cours » = confirme mais pas encore livre.
const ORDER_GROUPS = {
  pending: ['PENDING'],
  active: ['CONFIRMED', 'PREPARING', 'READY', 'ASSIGNED', 'PICKED_UP', 'ON_DELIVERY'],
  delivered: ['DELIVERED'],
  cancelled: ['CANCELLED'],
};
const ORDER_STATUSES = Object.keys(VALID_TRANSITIONS);
const PAYMENT_METHODS = ['MTN_MOMO', 'ORANGE_MONEY', 'CASH'];
const PAYMENT_STATUSES = ['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED'];
const EXPORT_LIMIT = 5000;

async function getOrderFull(id) {
  return prisma.order.findUnique({ where: { id }, include: FULL_INCLUDE });
}

// Filtres communs a la liste et a l'export CSV (hors statut : les compteurs des onglets les
// reutilisent sans le statut). Un client ne voit jamais que ses propres commandes.
function orderFilters(req) {
  const { payment, paymentStatus, zone, search, from, to } = req.query;
  const where = {};
  if (req.user.role === 'CUSTOMER') where.customerId = req.customerProfile.id;
  if (zone) where.deliveryZoneId = String(zone);

  const method = enumFilter(payment, PAYMENT_METHODS, 'Mode de paiement invalide');
  const paymentState = enumFilter(paymentStatus, PAYMENT_STATUSES, 'Statut de paiement invalide');
  if (method || paymentState) where.payment = { ...(method ? { method } : {}), ...(paymentState ? { status: paymentState } : {}) };

  const createdAt = createdAtRange(from, to);
  if (createdAt) where.createdAt = createdAt;

  const searchWhere = orderSearchWhere(search);
  if (searchWhere) where.AND = [searchWhere];
  return where;
}

// ?status=A,B ou ?group=pending|active|delivered|cancelled
function statusFilter(query) {
  const status = enumFilter(query.status, ORDER_STATUSES, 'Statut invalide');
  if (status) return status;
  if (query.group) {
    if (!ORDER_GROUPS[query.group]) throw new ApiError(400, 'Groupe de commandes invalide');
    return { in: ORDER_GROUPS[query.group] };
  }
  return undefined;
}

function groupCounts(byStatus) {
  const sum = (statuses) => byStatus.filter((g) => !statuses || statuses.includes(g.status)).reduce((n, g) => n + g._count._all, 0);
  const counts = { all: sum(null) };
  for (const [name, statuses] of Object.entries(ORDER_GROUPS)) counts[name] = sum(statuses);
  return counts;
}

// Apres une annulation : la livraison n'a plus lieu d'etre et un paiement non encaisse n'est plus
// attendu (sinon il resterait « en attente » pour toujours dans la page Paiements).
async function closeOrderFollowUps(tx, orderId) {
  await tx.delivery.updateMany({ where: { orderId, status: { not: 'DELIVERED' } }, data: { status: 'FAILED' } });
  await tx.payment.updateMany({ where: { orderId, status: { in: ['PENDING', 'PROCESSING'] } }, data: { status: 'CANCELLED' } });
}

// Previent le livreur d'une livraison assignee ou en cours qui vient d'etre annulee.
async function notifyDriverCancelled(order, delivery) {
  if (!delivery?.driverId || !['ASSIGNED', 'PICKED_UP', 'ON_ROUTE'].includes(delivery.status)) return;
  const driver = await prisma.driverProfile.findUnique({ where: { id: delivery.driverId } });
  if (!driver) return;
  await notify({
    userId: driver.userId,
    audience: 'DRIVER',
    title: 'Livraison annulée',
    message: `La commande ${order.orderNumber} a été annulée : ne la livrez pas.`,
    link: `/livreur/livraisons/${order.id}`,
  });
}

// Un livreur ne peut recevoir une livraison que si son compte est actif et non suspendu.
function ensureDriverAssignable(driver) {
  if (!driver) throw new ApiError(404, 'Livreur introuvable');
  if (driver.status === 'SUSPENDED') throw new ApiError(400, 'Ce livreur est suspendu');
  if (driver.user && driver.user.isActive === false) throw new ApiError(400, 'Le compte de ce livreur est desactive');
}

function contactOf(order) {
  const phone = order.guestPhone || order.customer?.user?.phone || null;
  return phone && !isPendingPhone(phone) ? phone : null;
}

// POST /api/orders - creation (client connecte OU invite, section 12)
// La logique de calcul/persistance vit dans services/order.service.js pour
// pouvoir etre reutilisee par le job des commandes recurrentes.
// GET /api/orders/cash-eligibility
const cashEligibility = asyncHandler(async (req, res) => {
  res.json(await cashService.cashEligibility(req.customerProfile?.id || null));
});

const createOrder = asyncHandler(async (req, res) => {
  const input = { ...req.body };
  if (req.customerProfile) input.customerId = req.customerProfile.id;

  const orderId = await orderService.createOrder(input);
  const order = await getOrderFull(orderId);
  const phone = contactOf(order);

  await notifyAdmins({
    title: 'Nouvelle commande',
    message: `${order.orderNumber} - ${order.total.toLocaleString('fr-FR')} FCFA`,
    link: `/admin/commandes/${order.id}`,
  });
  await notifyLowStock(order.items);

  await notify({
    userId: req.user?.id,
    audience: 'CUSTOMER',
    title: 'Commande reçue',
    message: `Votre commande ${order.orderNumber} a été enregistrée. Total : ${order.total.toLocaleString('fr-FR')} FCFA.`,
    link: `/compte/commandes/${order.id}`,
    phone,
    sms: true,
    whatsapp: true,
  });

  res.status(201).json(order);
});

// GET /api/orders (mine si client, toutes si admin avec filtres)
//   ?status=A,B | ?group=pending|active|delivered|cancelled  statut ou onglet
//   ?payment=CASH|MTN_MOMO|ORANGE_MONEY  mode ; ?paymentStatus=PENDING|PAID|...  etat du paiement
//   ?search=  numero, client, telephone, quartier ; ?from=AAAA-MM-JJ&to=AAAA-MM-JJ  (jours de Douala, `to` inclus)
// Pour l'administration la reponse contient aussi `counts` (par onglet, memes filtres hors statut).
const listOrders = asyncHandler(async (req, res) => {
  const { take, page, skip } = pagination(req.query);

  const base = orderFilters(req);
  const status = statusFilter(req.query);
  const where = status ? { ...base, status } : base;

  const queries = [
    prisma.order.findMany({ where, include: FULL_INCLUDE, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take, skip }),
    prisma.order.count({ where }),
  ];
  if (req.user.role === 'ADMIN') queries.push(prisma.order.groupBy({ by: ['status'], where: base, _count: { _all: true } }));

  const [items, total, byStatus] = await Promise.all(queries);
  res.json({ items, total, page, limit: take, ...(byStatus ? { counts: groupCounts(byStatus) } : {}) });
});

// GET /api/orders/export.csv (admin) - memes filtres que la liste, 5 000 lignes au plus.
const exportOrders = asyncHandler(async (req, res) => {
  const base = orderFilters(req);
  const status = statusFilter(req.query);

  const orders = await prisma.order.findMany({
    where: status ? { ...base, status } : base,
    include: {
      items: true,
      address: true,
      deliveryZone: true,
      payment: true,
      delivery: { include: { driver: { include: { user: { select: { firstName: true, lastName: true } } } } } },
      customer: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: EXPORT_LIMIT,
  });

  const header = [
    'N° commande', 'Date', 'Heure', 'Client', 'Téléphone', 'Quartier', 'Zone', 'Articles',
    'Sous-total (FCFA)', 'Livraison (FCFA)', 'Remise (FCFA)', 'Total (FCFA)',
    'Paiement', 'Statut du paiement', 'Statut de la commande', 'Livreur',
  ];
  const rows = orders.map((order) => {
    const customer = orderCustomer(order);
    const driverUser = order.delivery?.driver?.user;
    return [
      order.orderNumber,
      slashDate(order.createdAt),
      formatDoualaTime(order.createdAt),
      customer.name,
      customer.phone,
      order.address?.district || '',
      order.deliveryZone?.name || '',
      order.items.map((i) => `${i.quantity} × ${i.name}`).join(', '),
      order.subtotal,
      order.deliveryFee,
      order.discount,
      order.total,
      PAYMENT_METHOD_LABELS[order.payment?.method] || '',
      PAYMENT_STATUS_LABELS[order.payment?.status] || '',
      ORDER_STATUS_LABELS[order.status] || order.status,
      driverUser ? `${driverUser.firstName} ${driverUser.lastName}` : '',
    ];
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="commandes-${formatDoualaDay(new Date())}.csv"`);
  res.send(toCsv(header, rows));
});

// GET /api/orders/:id
const getOrder = asyncHandler(async (req, res) => {
  const order = await getOrderFull(req.params.id);
  if (!order) throw new ApiError(404, 'Commande introuvable');
  if (req.user.role === 'CUSTOMER' && order.customerId !== req.customerProfile.id) {
    throw new ApiError(403, 'Acces refuse');
  }
  res.json(order);
});

// GET /api/orders/track/:orderNumber?phone=xxx - suivi public (client invite)
const trackOrder = asyncHandler(async (req, res) => {
  const { orderNumber } = req.params;
  const { phone } = req.query;

  const order = await prisma.order.findUnique({ where: { orderNumber }, include: FULL_INCLUDE });
  if (!order) throw new ApiError(404, 'Commande introuvable');

  const ownerPhone = order.guestPhone || order.customer?.user?.phone;
  if (!samePhone(phone, ownerPhone)) {
    throw new ApiError(403, 'Numero de telephone incorrect pour cette commande');
  }

  res.json(order);
});

// PATCH /api/orders/:id/status (admin)  { status, note?, driverId? }
// Quand une commande passe a READY, le livreur choisi (driverId) lui est assigne ; sans choix,
// tente une attribution automatique du livreur le moins charge (section 76 "Livraison avancee") ;
// si aucun livreur n'est disponible, elle reste READY pour une assignation manuelle.
// « Assignee » ne se demande qu'avec un livreur. Les statuts « recuperee » / « en livraison » mis
// par l'administration (livreur sans reseau) mettent aussi a jour la livraison, pour que l'app
// livreur reste coherente.
const updateStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, note, driverId } = req.body;

  const [order, previousDelivery] = await Promise.all([
    prisma.order.findUnique({ where: { id } }),
    prisma.delivery.findUnique({ where: { orderId: id } }),
  ]);
  if (!order) throw new ApiError(404, 'Commande introuvable');

  const allowed = VALID_TRANSITIONS[order.status] || [];
  if (!allowed.includes(status)) {
    throw new ApiError(400, `Transition ${order.status} -> ${status} non autorisee`);
  }

  if (driverId && !['READY', 'ASSIGNED'].includes(status)) {
    throw new ApiError(400, 'Le livreur se choisit en passant la commande a « Prete » ou « Assignee »');
  }
  if (status === 'ASSIGNED' && !driverId) {
    throw new ApiError(400, 'Choisissez le livreur a qui assigner la commande');
  }
  let chosenDriver = null;
  if (driverId) {
    chosenDriver = await prisma.driverProfile.findUnique({ where: { id: driverId }, include: { user: true } });
    ensureDriverAssignable(chosenDriver);
  }

  let assignedDriver = null;

  await prisma.$transaction(async (tx) => {
    // « Assignee » est ecrit par performAssignment (statut + historique), pas deux fois.
    if (status !== 'ASSIGNED') {
      await tx.order.update({ where: { id }, data: { status } });
      await tx.orderStatusHistory.create({ data: { orderId: id, status, note } });
    }

    if (status === 'CANCELLED') {
      await orderService.releaseStock(tx, order);
      await closeOrderFollowUps(tx, id);
    }
    if (status === 'PICKED_UP') {
      await tx.delivery.updateMany({
        where: { orderId: id, status: { in: ['PENDING', 'ASSIGNED'] } },
        data: { status: 'PICKED_UP', pickedUpAt: new Date() },
      });
    }
    if (status === 'ON_DELIVERY') {
      await tx.delivery.updateMany({ where: { orderId: id, status: { in: ['PENDING', 'ASSIGNED', 'PICKED_UP'] } }, data: { status: 'ON_ROUTE' } });
    }
    if (status === 'DELIVERED') {
      await orderService.finalizeDelivery(tx, order);
      await tx.delivery.updateMany({ where: { orderId: id }, data: { status: 'DELIVERED', deliveredAt: new Date() } });
    }
    if (status === 'ASSIGNED') {
      await performAssignment(tx, id, chosenDriver.id);
      assignedDriver = chosenDriver;
    }
    if (status === 'READY') {
      const driver = chosenDriver || (await findBestDriver(tx));
      if (driver) {
        await performAssignment(tx, id, driver.id);
        assignedDriver = driver;
      }
    }
  });

  const updated = await getOrderFull(id);
  const phone = contactOf(updated);

  if (order.customerId || order.guestPhone) {
    await notify({
      userId: updated.customer?.userId,
      audience: 'CUSTOMER',
      title: 'Mise à jour de commande',
      message: `Votre commande ${order.orderNumber} est ${ORDER_STATUS_SENTENCES[updated.status] || ORDER_STATUS_LABELS[updated.status] || updated.status}.`,
      link: `/compte/commandes/${id}`,
      phone,
      sms: ['CONFIRMED', 'READY', 'ON_DELIVERY', 'CANCELLED'].includes(status),
    });
  }

  if (assignedDriver) {
    await notify({
      userId: assignedDriver.userId,
      audience: 'DRIVER',
      title: chosenDriver ? 'Nouvelle livraison' : 'Nouvelle livraison (auto-assignée)',
      message: chosenDriver ? `Commande ${order.orderNumber} vous a été assignée` : `Commande ${order.orderNumber} vous a été assignée automatiquement`,
      link: `/livreur/livraisons/${id}`,
    });
  }
  if (status === 'CANCELLED') await notifyDriverCancelled(order, previousDelivery);

  res.json(updated);
});

// POST /api/orders/:id/force-deliver (admin) - cas EXCEPTIONNEL : le livreur n'a pas pu saisir le code du client
// (empêchement) et présente des preuves (vidéo, photo...) à l'administration. Si elles sont jugées valables,
// l'administration valide la livraison. Un motif est obligatoire ; il est conservé dans l'historique de la commande.
const FORCE_DELIVER_FROM = ['ASSIGNED', 'PICKED_UP', 'ON_DELIVERY'];
const forceDeliver = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason, cashReceived } = req.body;

  const order = await prisma.order.findUnique({ where: { id }, include: { payment: true, delivery: true } });
  if (!order) throw new ApiError(404, 'Commande introuvable');
  if (order.status === 'DELIVERED') throw new ApiError(400, 'Cette commande est deja livree');
  if (!FORCE_DELIVER_FROM.includes(order.status) || !order.delivery) {
    throw new ApiError(400, 'Seule une commande assignee a un livreur et en cours de livraison peut etre validee comme livree');
  }

  // Espèces : si le livreur a encaissé, l'administration indique le montant ; sinon le paiement reste a regler.
  const isCash = order.payment?.method === 'CASH' && order.payment?.status !== 'PAID';
  const received = isCash && cashReceived != null ? Math.max(0, Math.round(Number(cashReceived) || 0)) : null;
  const cashComplete = isCash && received != null && received >= order.total;
  const adminName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || 'administrateur';

  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id }, data: { status: 'DELIVERED' } });
    await orderService.finalizeDelivery(tx, order);
    await tx.delivery.update({
      where: { orderId: id },
      data: { status: 'DELIVERED', deliveredAt: new Date(), ...(received != null ? { cashReceived: received } : {}) },
    });
    await tx.orderStatusHistory.create({
      data: { orderId: id, status: 'DELIVERED', note: `Livraison validee par l'administration (${adminName}) sans code client. Motif : ${reason}` },
    });
    if (isCash && cashComplete) await tx.payment.update({ where: { orderId: id }, data: { status: 'PAID' } });
  });

  const updated = await getOrderFull(id);
  const phone = contactOf(updated);

  if (order.customerId || order.guestPhone) {
    await notify({
      userId: updated.customer?.userId,
      audience: 'CUSTOMER',
      title: 'Commande livrée',
      message: `Votre commande ${order.orderNumber} a été livrée. Merci !`,
      link: `/compte/commandes/${id}`,
      phone,
      sms: true,
    });
  }
  const driverProfile = order.delivery.driverId
    ? await prisma.driverProfile.findUnique({ where: { id: order.delivery.driverId } })
    : null;
  if (driverProfile) {
    await notify({
      userId: driverProfile.userId,
      audience: 'DRIVER',
      title: 'Livraison validée',
      message: `L'administration a validé la livraison de la commande ${order.orderNumber}.`,
      link: `/livreur/livraisons/${id}`,
    });
  }

  res.json(updated);
});

// POST /api/orders/:id/assign-driver (admin) - assignation manuelle
const assignDriver = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { driverId } = req.body || {};
  if (!driverId) throw new ApiError(400, 'Livreur requis');

  const [order, driver, delivery] = await Promise.all([
    prisma.order.findUnique({ where: { id } }),
    prisma.driverProfile.findUnique({ where: { id: driverId }, include: { user: true } }),
    prisma.delivery.findUnique({ where: { orderId: id } }),
  ]);
  if (!order) throw new ApiError(404, 'Commande introuvable');
  ensureDriverAssignable(driver);
  if (!canAssign(order, delivery)) {
    throw new ApiError(400, "La commande doit etre prete avant d'etre assignee");
  }

  await prisma.$transaction((tx) => performAssignment(tx, id, driverId));

  await notify({
    userId: driver.userId,
    audience: 'DRIVER',
    title: 'Nouvelle livraison',
    message: `Commande ${order.orderNumber} vous a été assignée`,
    link: `/livreur/livraisons/${id}`,
  });

  res.json(await getOrderFull(id));
});

// POST /api/orders/:id/auto-assign-driver (admin) - relance l'attribution
// automatique a la demande (ex: un livreur vient de se liberer).
const autoAssignDriver = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [order, delivery] = await Promise.all([
    prisma.order.findUnique({ where: { id } }),
    prisma.delivery.findUnique({ where: { orderId: id } }),
  ]);
  if (!order) throw new ApiError(404, 'Commande introuvable');
  if (!canAssign(order, delivery)) {
    throw new ApiError(400, "La commande doit etre prete avant d'etre assignee");
  }

  const best = await findBestDriver();
  if (!best) throw new ApiError(409, 'Aucun livreur disponible pour le moment');

  await prisma.$transaction((tx) => performAssignment(tx, id, best.id));
  await notify({
    userId: best.userId,
    audience: 'DRIVER',
    title: 'Nouvelle livraison (auto-assignée)',
    message: `Commande ${order.orderNumber} vous a été assignée automatiquement`,
    link: `/livreur/livraisons/${id}`,
  });

  res.json(await getOrderFull(id));
});

// POST /api/orders/:id/cancel
const cancelOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [order, previousDelivery] = await Promise.all([
    prisma.order.findUnique({ where: { id }, include: { payment: true } }),
    prisma.delivery.findUnique({ where: { orderId: id } }),
  ]);
  if (!order) throw new ApiError(404, 'Commande introuvable');

  if (req.user.role === 'CUSTOMER') {
    if (order.customerId !== req.customerProfile.id) throw new ApiError(403, 'Acces refuse');
    if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
      throw new ApiError(400, 'Cette commande ne peut plus etre annulee, contactez le service client');
    }
  }

  if (!VALID_TRANSITIONS[order.status]?.includes('CANCELLED')) {
    throw new ApiError(400, 'Cette commande ne peut plus etre annulee');
  }

  await prisma.$transaction(async (tx) => {
    await orderService.releaseStock(tx, order);
    await tx.order.update({ where: { id }, data: { status: 'CANCELLED' } });
    await tx.orderStatusHistory.create({ data: { orderId: id, status: 'CANCELLED', note: req.body?.reason || 'Annulee' } });
    await closeOrderFollowUps(tx, id);
  });

  const alreadyPaid = order.payment?.status === 'PAID';
  await notifyAdmins({
    title: 'Commande annulée',
    message: alreadyPaid
      ? `${order.orderNumber} : paiement ${PAYMENT_METHOD_LABELS[order.payment.method] || ''} déjà encaissé, remboursement à prévoir`
      : order.orderNumber,
    link: `/admin/commandes/${id}`,
  });
  await notifyDriverCancelled(order, previousDelivery);

  const updated = await getOrderFull(id);
  // Annulee par l'administration : le client en est averti (annulee par lui-meme, il le sait deja).
  if (req.user.role === 'ADMIN' && (order.customerId || order.guestPhone)) {
    await notify({
      userId: updated.customer?.userId,
      audience: 'CUSTOMER',
      title: 'Commande annulée',
      message: `Votre commande ${order.orderNumber} a été annulée.${req.body?.reason ? ` Motif : ${req.body.reason}` : ''}`,
      link: `/compte/commandes/${id}`,
      phone: contactOf(updated),
      sms: true,
    });
  }

  res.json(updated);
});

// GET /api/orders/:id/invoice.pdf (section 46 - facture PDF, compte connecté)
const downloadInvoice = asyncHandler(async (req, res) => {
  const order = await getOrderFull(req.params.id);
  if (!order) throw new ApiError(404, 'Commande introuvable');
  if (req.user.role === 'CUSTOMER' && order.customerId !== req.customerProfile.id) {
    throw new ApiError(403, 'Acces refuse');
  }
  generateInvoicePdf(order, res);
});

// GET /api/orders/track/:orderNumber/invoice.pdf?phone=xxx - meme facture,
// accessible sans compte (invite) via la meme verification que le suivi public.
const downloadInvoiceByTracking = asyncHandler(async (req, res) => {
  const { orderNumber } = req.params;
  const { phone } = req.query;

  const order = await prisma.order.findUnique({ where: { orderNumber }, include: FULL_INCLUDE });
  if (!order) throw new ApiError(404, 'Commande introuvable');

  const ownerPhone = order.guestPhone || order.customer?.user?.phone;
  if (!samePhone(phone, ownerPhone)) {
    throw new ApiError(403, 'Numero de telephone incorrect pour cette commande');
  }

  generateInvoicePdf(order, res);
});

module.exports = {
  createOrder,
  cashEligibility,
  listOrders,
  exportOrders,
  getOrder,
  trackOrder,
  updateStatus,
  forceDeliver,
  assignDriver,
  autoAssignDriver,
  cancelOrder,
  downloadInvoice,
  downloadInvoiceByTracking,
  getOrderFull,
  VALID_TRANSITIONS,
};
