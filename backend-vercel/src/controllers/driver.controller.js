const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { finalizeDelivery } = require('../services/order.service');
const { getOrderFull } = require('./order.controller');
const { notify, notifyAdmins } = require('../utils/notify');
const { sendSms } = require('../integrations/sms');

// ---------------------------------------------------------------------------
// Gestion des livreurs par l'administrateur (section 34)
// ---------------------------------------------------------------------------

const listDrivers = asyncHandler(async (req, res) => {
  const drivers = await prisma.driverProfile.findMany({
    include: {
      user: { select: { id: true, firstName: true, lastName: true, phone: true, email: true, isActive: true } },
      _count: { select: { deliveries: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(drivers);
});

const createDriver = asyncHandler(async (req, res) => {
  const { firstName, lastName, phone, email, password, vehicle } = req.body;

  const existing = await prisma.user.findFirst({ where: { OR: [{ phone }, ...(email ? [{ email }] : [])] } });
  if (existing) throw new ApiError(409, 'Un compte existe deja avec ce telephone ou cet email');

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      firstName,
      lastName,
      phone,
      email: email || null,
      password: hashed,
      role: 'DRIVER',
      driverProfile: { create: { vehicle, status: 'OFFLINE' } },
    },
    include: { driverProfile: true },
  });

  res.status(201).json(user.driverProfile);
});

// PATCH /api/drivers/:id (admin) - statut, vehicule, activation du compte
const updateDriver = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, vehicle, isActive } = req.body;

  const driver = await prisma.driverProfile.findUnique({ where: { id } });
  if (!driver) throw new ApiError(404, 'Livreur introuvable');

  const updated = await prisma.driverProfile.update({
    where: { id },
    data: { status, vehicle },
    include: { user: true },
  });

  if (typeof isActive === 'boolean') {
    await prisma.user.update({ where: { id: driver.userId }, data: { isActive } });
  }

  res.json(updated);
});

// ---------------------------------------------------------------------------
// Espace livreur (section 36-39)
// ---------------------------------------------------------------------------

const requireDriverProfile = (req) => {
  if (!req.driverProfile) throw new ApiError(403, "Ce compte n'est pas un compte livreur");
  return req.driverProfile;
};

// GET /api/driver/deliveries
const myDeliveries = asyncHandler(async (req, res) => {
  const driver = requireDriverProfile(req);
  const { status } = req.query;

  const deliveries = await prisma.delivery.findMany({
    where: { driverId: driver.id, ...(status ? { status } : {}) },
    include: {
      order: {
        include: { items: true, address: true, payment: true, deliveryZone: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(deliveries);
});

const getDelivery = asyncHandler(async (req, res) => {
  const driver = requireDriverProfile(req);
  const delivery = await prisma.delivery.findUnique({
    where: { orderId: req.params.orderId },
    include: { order: { include: { items: true, address: true, payment: true, deliveryZone: true } } },
  });
  if (!delivery || delivery.driverId !== driver.id) throw new ApiError(404, 'Livraison introuvable');
  res.json(delivery);
});

// PATCH /api/driver/deliveries/:orderId/status - PICKED_UP / ON_ROUTE
const updateDeliveryStatus = asyncHandler(async (req, res) => {
  const driver = requireDriverProfile(req);
  const { orderId } = req.params;
  const { status } = req.body; // PICKED_UP | ON_ROUTE

  const delivery = await prisma.delivery.findUnique({ where: { orderId } });
  if (!delivery || delivery.driverId !== driver.id) throw new ApiError(404, 'Livraison introuvable');

  const orderStatusMap = { PICKED_UP: 'PICKED_UP', ON_ROUTE: 'ON_DELIVERY' };
  if (!orderStatusMap[status]) throw new ApiError(400, 'Statut invalide');

  await prisma.$transaction([
    prisma.delivery.update({
      where: { orderId },
      data: { status, pickedUpAt: status === 'PICKED_UP' ? new Date() : undefined },
    }),
    prisma.order.update({ where: { id: orderId }, data: { status: orderStatusMap[status] } }),
    prisma.orderStatusHistory.create({ data: { orderId, status: orderStatusMap[status], note: `Mis a jour par le livreur` } }),
  ]);

  res.json(await getOrderFull(orderId));
});

// POST /api/driver/deliveries/:orderId/confirm - code + encaissement especes (section 38-39)
const confirmDelivery = asyncHandler(async (req, res) => {
  const driver = requireDriverProfile(req);
  const { orderId } = req.params;
  const { code, cashReceived } = req.body;

  const delivery = await prisma.delivery.findUnique({
    where: { orderId },
    include: { order: { include: { payment: true, items: true } } },
  });
  if (!delivery || delivery.driverId !== driver.id) throw new ApiError(404, 'Livraison introuvable');
  if (delivery.status === 'DELIVERED') throw new ApiError(400, 'Livraison deja confirmee');
  if (delivery.confirmationCode !== String(code)) throw new ApiError(400, 'Code de confirmation invalide');

  const isCash = delivery.order.payment?.method === 'CASH';
  const cashComplete = !isCash || (cashReceived != null && Number(cashReceived) >= delivery.order.total);

  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: orderId }, data: { status: 'DELIVERED' } });
    await finalizeDelivery(tx, delivery.order);
    await tx.delivery.update({
      where: { orderId },
      data: { status: 'DELIVERED', deliveredAt: new Date(), cashReceived: isCash ? Number(cashReceived) || 0 : null },
    });
    await tx.orderStatusHistory.create({ data: { orderId, status: 'DELIVERED', note: 'Livraison confirmee par le livreur' } });
    if (isCash) {
      await tx.payment.update({ where: { orderId }, data: { status: cashComplete ? 'PAID' : 'PENDING' } });
    }
  });

  if (!cashComplete) {
    await notifyAdmins({
      title: 'Paiement incomplet',
      message: `${delivery.order.orderNumber} : ${cashReceived} FCFA recus sur ${delivery.order.total} FCFA attendus`,
      link: `/admin/orders/${orderId}`,
    });
  }
  if (delivery.order.customerId) {
    const owner = await prisma.customerProfile.findUnique({ where: { id: delivery.order.customerId }, include: { user: true } });
    await notify({ userId: owner.userId, audience: 'CUSTOMER', title: 'Commande livree', message: `Votre commande ${delivery.order.orderNumber} a ete livree. Merci !`, link: `/compte/commandes/${orderId}` });
    await sendSms(owner.user.phone, `NONO SMART : votre commande ${delivery.order.orderNumber} a ete livree. Merci pour votre confiance !`);
  } else if (delivery.order.guestPhone) {
    await sendSms(delivery.order.guestPhone, `NONO SMART : votre commande ${delivery.order.orderNumber} a ete livree. Merci pour votre confiance !`);
  }

  res.json(await getOrderFull(orderId));
});

// PATCH /api/driver/me/status - le livreur bascule sa propre disponibilite
const updateMyStatus = asyncHandler(async (req, res) => {
  const driver = requireDriverProfile(req);
  const { status } = req.body;
  if (!['AVAILABLE', 'BUSY', 'OFFLINE'].includes(status)) throw new ApiError(400, 'Statut invalide');
  const updated = await prisma.driverProfile.update({ where: { id: driver.id }, data: { status } });
  res.json(updated);
});

// PATCH /api/driver/me/location - position GPS envoyee periodiquement par
// l'app livreur pendant une livraison en cours (section 75 "suivi livreur").
const updateMyLocation = asyncHandler(async (req, res) => {
  const driver = requireDriverProfile(req);
  const { latitude, longitude } = req.body;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new ApiError(400, 'Coordonnees GPS invalides');
  }
  await prisma.driverProfile.update({
    where: { id: driver.id },
    data: { lastLatitude: latitude, lastLongitude: longitude, lastLocationAt: new Date() },
  });
  res.json({ message: 'Position mise a jour' });
});

module.exports = {
  listDrivers,
  createDriver,
  updateDriver,
  myDeliveries,
  getDelivery,
  updateDeliveryStatus,
  confirmDelivery,
  updateMyStatus,
  updateMyLocation,
};
