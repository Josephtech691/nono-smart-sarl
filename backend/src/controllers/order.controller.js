const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const orderService = require('../services/order.service');
const { findBestDriver, performAssignment } = require('../utils/driverAssignment');
const { notify, notifyAdmins } = require('../utils/notify');
const { generateInvoicePdf } = require('../utils/generateInvoicePdf');

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
  statusHistory: { orderBy: { createdAt: 'asc' } },
  customer: { include: { user: true } },
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

async function getOrderFull(id) {
  return prisma.order.findUnique({ where: { id }, include: FULL_INCLUDE });
}

function contactOf(order) {
  return order.guestPhone || order.customer?.user?.phone || null;
}

// POST /api/orders - creation (client connecte OU invite, section 12)
// La logique de calcul/persistance vit dans services/order.service.js pour
// pouvoir etre reutilisee par le job des commandes recurrentes.
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
const listOrders = asyncHandler(async (req, res) => {
  const { status, payment, zone: zoneId, search, from, to, page = '1', limit = '20' } = req.query;
  const take = Math.min(Number(limit) || 20, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const where = {};
  if (req.user.role === 'CUSTOMER') {
    where.customerId = req.customerProfile.id;
  }
  if (status) where.status = status;
  if (zoneId) where.deliveryZoneId = zoneId;
  if (payment) where.payment = { method: payment };
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: 'insensitive' } },
      { guestName: { contains: search, mode: 'insensitive' } },
      { guestPhone: { contains: search } },
      { address: { phone: { contains: search } } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.order.findMany({ where, include: FULL_INCLUDE, orderBy: { createdAt: 'desc' }, take, skip }),
    prisma.order.count({ where }),
  ]);

  res.json({ items, total, page: Number(page) || 1, limit: take });
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
  if (!phone || phone !== ownerPhone) {
    throw new ApiError(403, 'Numero de telephone incorrect pour cette commande');
  }

  res.json(order);
});

// PATCH /api/orders/:id/status (admin)
// Quand une commande passe a READY, tente une attribution automatique du
// livreur le moins charge (section 76 "Livraison avancee") ; si aucun
// livreur n'est disponible, elle reste READY pour une assignation manuelle.
const updateStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, note } = req.body;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new ApiError(404, 'Commande introuvable');

  const allowed = VALID_TRANSITIONS[order.status] || [];
  if (!allowed.includes(status)) {
    throw new ApiError(400, `Transition ${order.status} -> ${status} non autorisee`);
  }

  let autoAssignedDriver = null;

  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id }, data: { status } });
    await tx.orderStatusHistory.create({ data: { orderId: id, status, note } });

    if (status === 'CANCELLED') await orderService.releaseStock(tx, order);
    if (status === 'DELIVERED') {
      await orderService.finalizeDelivery(tx, order);
      await tx.delivery.update({ where: { orderId: id }, data: { status: 'DELIVERED', deliveredAt: new Date() } }).catch(() => {});
    }
    if (status === 'READY') {
      const best = await findBestDriver(tx);
      if (best) {
        await performAssignment(tx, id, best.id);
        autoAssignedDriver = best;
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
      message: `Votre commande ${order.orderNumber} est maintenant : ${status}`,
      link: `/compte/commandes/${id}`,
      phone,
      sms: ['CONFIRMED', 'READY', 'ON_DELIVERY', 'CANCELLED'].includes(status),
    });
  }

  if (autoAssignedDriver) {
    await notify({
      userId: autoAssignedDriver.userId,
      audience: 'DRIVER',
      title: 'Nouvelle livraison (auto-assignée)',
      message: `Commande ${order.orderNumber} vous a été assignée automatiquement`,
      link: `/livreur/livraisons/${id}`,
    });
  }

  res.json(updated);
});

// POST /api/orders/:id/assign-driver (admin) - assignation manuelle
const assignDriver = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { driverId } = req.body;

  const [order, driver] = await Promise.all([
    prisma.order.findUnique({ where: { id } }),
    prisma.driverProfile.findUnique({ where: { id: driverId }, include: { user: true } }),
  ]);
  if (!order) throw new ApiError(404, 'Commande introuvable');
  if (!driver) throw new ApiError(404, 'Livreur introuvable');
  if (driver.status === 'SUSPENDED') throw new ApiError(400, 'Ce livreur est suspendu');
  if (!['READY', 'ASSIGNED', 'CONFIRMED', 'PREPARING'].includes(order.status)) {
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
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new ApiError(404, 'Commande introuvable');

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
  const order = await prisma.order.findUnique({ where: { id } });
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
    await tx.delivery.update({ where: { orderId: id }, data: { status: 'FAILED' } }).catch(() => {});
  });

  await notifyAdmins({ title: 'Commande annulée', message: order.orderNumber, link: `/admin/commandes/${id}` });

  res.json(await getOrderFull(id));
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
  if (!phone || phone !== ownerPhone) {
    throw new ApiError(403, 'Numero de telephone incorrect pour cette commande');
  }

  generateInvoicePdf(order, res);
});

module.exports = {
  createOrder,
  listOrders,
  getOrder,
  trackOrder,
  updateStatus,
  assignDriver,
  autoAssignDriver,
  cancelOrder,
  downloadInvoice,
  downloadInvoiceByTracking,
  getOrderFull,
  VALID_TRANSITIONS,
};
