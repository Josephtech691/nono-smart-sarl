const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { finalizeDelivery } = require('../services/order.service');
const { notify, notifyAdmins } = require('../utils/notify');
const { sendSms } = require('../integrations/sms');
const { SAFE_USER_SELECT } = require('../utils/safeUser');
const { phoneCandidates, normalizePhoneForStorage } = require('../utils/phone');
const { startOfDayDouala } = require('../utils/time');
const { orderSearchWhere, createdAtRange, pagination } = require('../utils/orderSearch');
const { generateTempPassword } = require('../utils/tempPassword');

// ---------------------------------------------------------------------------
// Gestion des livreurs par l'administrateur (section 34)
// ---------------------------------------------------------------------------

// GET /api/drivers (admin) - chaque livreur avec ses compteurs de livraisons :
// stats = { todo, active, delivered, failed, deliveredToday }
const listDrivers = asyncHandler(async (req, res) => {
  const [drivers, byStatus, deliveredToday] = await Promise.all([
    prisma.driverProfile.findMany({
      include: {
        user: { select: { id: true, firstName: true, lastName: true, phone: true, email: true, isActive: true } },
        _count: { select: { deliveries: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.delivery.groupBy({ by: ['driverId', 'status'], where: { driverId: { not: null } }, _count: { _all: true } }),
    prisma.delivery.groupBy({
      by: ['driverId'],
      where: { driverId: { not: null }, status: 'DELIVERED', deliveredAt: { gte: startOfDayDouala() } },
      _count: { _all: true },
    }),
  ]);

  const statsFor = (id) => {
    const count = (...statuses) =>
      byStatus.filter((g) => g.driverId === id && statuses.includes(g.status)).reduce((n, g) => n + g._count._all, 0);
    return {
      todo: count('PENDING', 'ASSIGNED'),
      active: count('PICKED_UP', 'ON_ROUTE'),
      delivered: count('DELIVERED'),
      failed: count('FAILED'),
      deliveredToday: deliveredToday.filter((g) => g.driverId === id).reduce((n, g) => n + g._count._all, 0),
    };
  };

  res.json(drivers.map((d) => ({ ...d, stats: statsFor(d.id) })));
});

// Onglets de la page « Livraisons » de l'administration (statut de la livraison + etat de la commande).
const DELIVERY_GROUPS = {
  // Commande confirmee, sans livreur : il faut en choisir un.
  unassigned: { status: 'PENDING', driverId: null, order: { status: { in: ['CONFIRMED', 'PREPARING', 'READY'] } } },
  // Livreur designe, pas encore parti.
  assigned: { status: 'ASSIGNED', order: { status: { not: 'CANCELLED' } } },
  active: { status: { in: ['PICKED_UP', 'ON_ROUTE'] }, order: { status: { not: 'CANCELLED' } } },
  delivered: { status: 'DELIVERED' },
  // Probleme signale par le livreur et pas encore resolu (une commande annulee n'est plus un probleme).
  problem: { status: 'FAILED', order: { status: { notIn: ['DELIVERED', 'CANCELLED'] } } },
};

// GET /api/drivers/deliveries (admin)
//   ?group=unassigned|assigned|active|delivered|problem  ?driverId=  ?search=  ?from=&to=  ?page=&limit=
// Reponse : { items, total, page, limit, counts } ; `counts` suit les memes filtres hors onglet.
// Le code de confirmation du client n'est jamais renvoye dans une liste.
const listDeliveries = asyncHandler(async (req, res) => {
  const { group, driverId } = req.query;
  if (group && !DELIVERY_GROUPS[group]) throw new ApiError(400, 'Onglet de livraisons invalide');
  const { take, page, skip } = pagination(req.query);

  const base = {};
  if (driverId) base.driverId = String(driverId);
  const createdAt = createdAtRange(req.query.from, req.query.to);
  if (createdAt) base.createdAt = createdAt;
  const searchWhere = orderSearchWhere(req.query.search);
  if (searchWhere) base.order = { AND: [searchWhere] };

  const inGroup = (name) => ({ AND: [base, DELIVERY_GROUPS[name]] });
  const where = group ? inGroup(group) : base;

  const names = Object.keys(DELIVERY_GROUPS);
  const [rows, total, all, ...perGroup] = await Promise.all([
    prisma.delivery.findMany({
      where,
      include: {
        driver: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } },
        order: { include: { items: true, address: true, payment: true, deliveryZone: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      skip,
    }),
    prisma.delivery.count({ where }),
    prisma.delivery.count({ where: base }),
    ...names.map((name) => prisma.delivery.count({ where: inGroup(name) })),
  ]);

  const counts = { all };
  names.forEach((name, i) => {
    counts[name] = perGroup[i];
  });

  res.json({ items: rows.map(withoutCode), total, page, limit: take, counts });
});

// POST /api/drivers/:id/reset-password (admin) - mot de passe provisoire, affiche une seule fois.
// Le livreur le change ensuite depuis son profil. Les sessions deja ouvertes restent valides jusqu'a
// leur expiration : pour couper l'acces tout de suite, desactiver le compte.
const resetDriverPassword = asyncHandler(async (req, res) => {
  const driver = await prisma.driverProfile.findUnique({ where: { id: req.params.id } });
  if (!driver) throw new ApiError(404, 'Livreur introuvable');

  const temporaryPassword = generateTempPassword();
  await prisma.user.update({ where: { id: driver.userId }, data: { password: await bcrypt.hash(temporaryPassword, 10) } });

  res.set('Cache-Control', 'no-store');
  res.json({ temporaryPassword });
});

const createDriver = asyncHandler(async (req, res) => {
  const { firstName, lastName, phone, email, password, vehicle } = req.body;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ phone: { in: phoneCandidates(phone) } }, ...(email ? [{ email }] : [])] },
  });
  if (existing) throw new ApiError(409, 'Un compte existe deja avec ce telephone ou cet email');

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      firstName,
      lastName,
      phone: normalizePhoneForStorage(phone),
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
    include: { user: { select: SAFE_USER_SELECT } },
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

// Le code de confirmation appartient au client (affiche dans son compte et son suivi) : le
// livreur doit le lui demander sur place. S'il pouvait le lire dans l'API, la verification ne
// prouverait plus rien -> il est retire de toutes les reponses destinees au livreur.
function withoutCode(delivery) {
  if (!delivery) return delivery;
  const { confirmationCode, ...safe } = delivery;
  return safe;
}

const DELIVERY_INCLUDE = { order: { include: { items: true, address: true, payment: true, deliveryZone: true } } };

// Livraison + commande, au format de l'app livreur (celui du detail), sans code de confirmation.
async function deliveryView(orderId) {
  return withoutCode(await prisma.delivery.findUnique({ where: { orderId }, include: DELIVERY_INCLUDE }));
}

// Le livreur ne peut agir que sur une livraison encore « vivante ». Sans ce controle,
// il pourrait rouvrir une livraison deja confirmee (le stock serait decompte deux fois),
// ou confirmer la livraison d'une commande annulee.
function ensureLive(delivery) {
  if (delivery.status === 'DELIVERED' || delivery.order.status === 'DELIVERED') throw new ApiError(400, 'Livraison deja confirmee');
  if (delivery.order.status === 'CANCELLED') throw new ApiError(400, 'Cette commande a ete annulee');
  if (!ACTIVE_STATUSES.includes(delivery.status)) {
    throw new ApiError(400, "Cette livraison n'est plus active : un probleme a ete signale, attendez les instructions de l'administration");
  }
}

// Anti-devinette du code client a 4 chiffres : 5 erreurs maximum par livraison, puis
// blocage 30 minutes. Compteur en memoire : suffisant contre un essai « a la main » ;
// sur un hebergement serverless chaque instance a son propre compteur (protection partielle).
const CODE_MAX_FAILURES = 5;
const CODE_WINDOW_MS = 30 * 60 * 1000;
const codeFailures = new Map(); // orderId -> { count, since }

function codeAttemptsLocked(orderId) {
  const entry = codeFailures.get(orderId);
  if (!entry) return false;
  if (Date.now() - entry.since > CODE_WINDOW_MS) {
    codeFailures.delete(orderId);
    return false;
  }
  return entry.count >= CODE_MAX_FAILURES;
}

function recordCodeFailure(orderId) {
  const now = Date.now();
  const entry = codeFailures.get(orderId);
  if (!entry || now - entry.since > CODE_WINDOW_MS) codeFailures.set(orderId, { count: 1, since: now });
  else entry.count += 1;
  if (codeFailures.size > 2000) {
    for (const [key, value] of codeFailures) if (now - value.since > CODE_WINDOW_MS) codeFailures.delete(key);
  }
}

// Livraisons encore « vivantes » (le livreur peut agir dessus).
const ACTIVE_STATUSES = ['PENDING', 'ASSIGNED', 'PICKED_UP', 'ON_ROUTE'];

// GET /api/drivers/me/deliveries?scope=active|history&page=1&limit=20
//  - scope=active  : livraisons a faire ou en cours (liste courte, sans pagination)
//  - scope=history : livraisons terminees (livrees) ou sans suite (probleme signale, annulee)
//  - sans scope    : tout (comportement historique) ; ?status= filtre sur un statut precis
const myDeliveries = asyncHandler(async (req, res) => {
  const driver = requireDriverProfile(req);
  const { status, scope } = req.query;
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 0, 0), 100);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

  const where = { driverId: driver.id };
  if (status) where.status = status;
  else if (scope === 'active') where.status = { in: ACTIVE_STATUSES };
  else if (scope === 'history') where.status = { in: ['DELIVERED', 'FAILED'] };

  const deliveries = await prisma.delivery.findMany({
    where,
    include: DELIVERY_INCLUDE,
    orderBy: { createdAt: 'desc' },
    ...(limit ? { take: limit, skip: (page - 1) * limit } : {}),
  });
  res.json(deliveries.map(withoutCode));
});

// GET /api/drivers/me/summary - compteurs de l'accueil et du profil du livreur
const mySummary = asyncHandler(async (req, res) => {
  const driver = requireDriverProfile(req);
  const where = { driverId: driver.id };

  const [byStatus, today, total] = await Promise.all([
    prisma.delivery.groupBy({ by: ['status'], where, _count: { _all: true } }),
    prisma.delivery.aggregate({
      where: { ...where, status: 'DELIVERED', deliveredAt: { gte: startOfDayDouala() } },
      _count: { _all: true },
      _sum: { cashReceived: true },
    }),
    prisma.delivery.aggregate({ where: { ...where, status: 'DELIVERED' }, _count: { _all: true }, _sum: { cashReceived: true } }),
  ]);

  const count = (...statuses) => byStatus.filter((g) => statuses.includes(g.status)).reduce((n, g) => n + g._count._all, 0);

  res.json({
    status: driver.status,
    todo: count('PENDING', 'ASSIGNED'),
    inProgress: count('PICKED_UP', 'ON_ROUTE'),
    delivered: count('DELIVERED'),
    failed: count('FAILED'),
    today: { delivered: today._count._all, cashCollected: today._sum.cashReceived || 0 },
    total: { delivered: total._count._all, cashCollected: total._sum.cashReceived || 0 },
  });
});

const getDelivery = asyncHandler(async (req, res) => {
  const driver = requireDriverProfile(req);
  const delivery = await prisma.delivery.findUnique({
    where: { orderId: req.params.orderId },
    include: DELIVERY_INCLUDE,
  });
  if (!delivery || delivery.driverId !== driver.id) throw new ApiError(404, 'Livraison introuvable');
  res.json(withoutCode(delivery));
});

// PATCH /api/driver/deliveries/:orderId/status - PICKED_UP / ON_ROUTE
const updateDeliveryStatus = asyncHandler(async (req, res) => {
  const driver = requireDriverProfile(req);
  const { orderId } = req.params;
  const { status } = req.body; // PICKED_UP | ON_ROUTE

  const delivery = await prisma.delivery.findUnique({ where: { orderId }, include: { order: true } });
  if (!delivery || delivery.driverId !== driver.id) throw new ApiError(404, 'Livraison introuvable');

  const orderStatusMap = { PICKED_UP: 'PICKED_UP', ON_ROUTE: 'ON_DELIVERY' };
  if (!orderStatusMap[status]) throw new ApiError(400, 'Statut invalide');

  ensureLive(delivery);
  // Parcours : a faire -> recuperee -> en route (pas de retour en arriere, pas de saut).
  const previousStatus = { PICKED_UP: ['PENDING', 'ASSIGNED'], ON_ROUTE: ['PICKED_UP'] }[status];
  if (!previousStatus.includes(delivery.status)) {
    throw new ApiError(400, status === 'ON_ROUTE' ? "Commencez d'abord la livraison" : 'Cette livraison est deja commencee');
  }

  await prisma.$transaction([
    prisma.delivery.update({
      where: { orderId },
      data: { status, pickedUpAt: status === 'PICKED_UP' ? new Date() : undefined },
    }),
    prisma.order.update({ where: { id: orderId }, data: { status: orderStatusMap[status] } }),
    prisma.orderStatusHistory.create({ data: { orderId, status: orderStatusMap[status], note: `Mis a jour par le livreur` } }),
  ]);

  res.json(await deliveryView(orderId));
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
  ensureLive(delivery);
  if (!['PICKED_UP', 'ON_ROUTE'].includes(delivery.status)) {
    throw new ApiError(400, "Commencez d'abord la livraison avant de la confirmer");
  }

  if (codeAttemptsLocked(orderId)) {
    throw new ApiError(429, "Trop d'essais pour cette livraison. Patientez 30 minutes ou contactez l'administration.");
  }
  if (delivery.confirmationCode !== String(code)) {
    recordCodeFailure(orderId);
    throw new ApiError(400, 'Code de confirmation invalide');
  }
  codeFailures.delete(orderId);

  // Especes a encaisser : paiement CASH pas encore regle. Si l'administration a deja enregistre le
  // paiement (client qui a paye a l'avance), le livreur n'a rien a percevoir et on ne touche pas au paiement.
  const isCash = delivery.order.payment?.method === 'CASH' && delivery.order.payment?.status !== 'PAID';
  const received = isCash ? Math.max(0, Math.round(Number(cashReceived) || 0)) : null;
  const cashComplete = !isCash || received >= delivery.order.total;

  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: orderId }, data: { status: 'DELIVERED' } });
    await finalizeDelivery(tx, delivery.order);
    await tx.delivery.update({
      where: { orderId },
      data: { status: 'DELIVERED', deliveredAt: new Date(), cashReceived: received },
    });
    await tx.orderStatusHistory.create({ data: { orderId, status: 'DELIVERED', note: 'Livraison confirmee par le livreur' } });
    if (isCash) {
      await tx.payment.update({ where: { orderId }, data: { status: cashComplete ? 'PAID' : 'PENDING' } });
    }
  });

  if (!cashComplete) {
    await notifyAdmins({
      title: 'Paiement incomplet',
      message: `${delivery.order.orderNumber} : ${received} FCFA recus sur ${delivery.order.total} FCFA attendus`,
      link: `/admin/commandes/${orderId}`,
    });
  }
  if (delivery.order.customerId) {
    const owner = await prisma.customerProfile.findUnique({ where: { id: delivery.order.customerId }, include: { user: true } });
    await notify({ userId: owner.userId, audience: 'CUSTOMER', title: 'Commande livree', message: `Votre commande ${delivery.order.orderNumber} a ete livree. Merci !`, link: `/compte/commandes/${orderId}` });
    await sendSms(owner.user.phone, `Fresh Fish : votre commande ${delivery.order.orderNumber} a ete livree. Merci pour votre confiance !`);
  } else if (delivery.order.guestPhone) {
    await sendSms(delivery.order.guestPhone, `Fresh Fish : votre commande ${delivery.order.orderNumber} a ete livree. Merci pour votre confiance !`);
  }

  res.json(await deliveryView(orderId));
});

// PATCH /api/driver/me/status - le livreur bascule sa propre disponibilite
const updateMyStatus = asyncHandler(async (req, res) => {
  const driver = requireDriverProfile(req);
  const { status } = req.body;
  if (!['AVAILABLE', 'BUSY', 'OFFLINE'].includes(status)) throw new ApiError(400, 'Statut invalide');
  if (driver.status === 'SUSPENDED') throw new ApiError(403, "Votre compte livreur est suspendu : contactez l'administration");
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

// POST /api/driver/deliveries/:orderId/report-issue - le livreur signale un
// probleme (client injoignable, adresse introuvable, colis refuse...) au lieu
// de confirmer la livraison (mockup : bouton "Probleme avec la livraison").
// Previent l'administrateur qui decide de la suite (nouvelle tentative,
// reassignation, annulation) - ne modifie pas seul le statut de la commande.
const ISSUE_REASONS = {
  CLIENT_INJOIGNABLE: 'Client injoignable',
  ADRESSE_INTROUVABLE: 'Adresse introuvable',
  CLIENT_ABSENT: 'Client absent',
  COLIS_REFUSE: 'Colis refuse par le client',
  AUTRE: 'Autre probleme',
};

const reportIssue = asyncHandler(async (req, res) => {
  const driver = requireDriverProfile(req);
  const { orderId } = req.params;
  const { reason, note } = req.body;

  if (!ISSUE_REASONS[reason]) throw new ApiError(400, 'Motif invalide');

  const delivery = await prisma.delivery.findUnique({ where: { orderId }, include: { order: true } });
  if (!delivery || delivery.driverId !== driver.id) throw new ApiError(404, 'Livraison introuvable');
  if (delivery.status === 'DELIVERED') throw new ApiError(400, 'Cette livraison est deja confirmee');

  const label = ISSUE_REASONS[reason];

  await prisma.$transaction([
    prisma.delivery.update({ where: { id: delivery.id }, data: { status: 'FAILED' } }),
    prisma.orderStatusHistory.create({
      data: {
        orderId,
        status: delivery.order.status,
        note: `Probleme signale par le livreur : ${label}${note ? ` - ${note}` : ''}`,
      },
    }),
  ]);

  await notifyAdmins({
    title: 'Probleme de livraison signale',
    message: `Commande ${delivery.order.orderNumber} : ${label}${note ? ` (${note})` : ''}`,
    link: `/admin/commandes/${orderId}`,
  });

  res.json({ message: "Probleme signale a l'administrateur" });
});

module.exports = {
  listDrivers,
  listDeliveries,
  resetDriverPassword,
  createDriver,
  updateDriver,
  myDeliveries,
  mySummary,
  getDelivery,
  updateDeliveryStatus,
  confirmDelivery,
  updateMyStatus,
  updateMyLocation,
  reportIssue,
  ISSUE_REASONS,
};
