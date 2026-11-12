const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { DAY_MS, startOfDayDouala, startOfMonthDouala, formatDoualaDay } = require('../utils/time');

// Tous les « jours » de l'administration sont des jours de Douala (UTC+1), pas ceux du serveur
// (UTC chez les hebergeurs) : sinon une commande passee entre minuit et 1 h serait comptee la veille.
// Debut (minuit, heure de Douala) du jour situe n jours avant aujourd'hui.
function daysAgo(n) {
  return new Date(startOfDayDouala().getTime() - n * DAY_MS);
}

// ?days=30 -> entier de 1 a max, ou null s'il est absent ou invalide.
function parseDays(value, max = 366) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : null;
}

// Variation en % ; null quand il n'y a rien a comparer (valeur precedente nulle).
function percentChange(current, previous) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

const IN_PROGRESS_STATUSES = ['CONFIRMED', 'PREPARING', 'READY', 'ASSIGNED', 'PICKED_UP', 'ON_DELIVERY'];

// GET /api/statistics/dashboard (section 52)
// Les comparaisons se font « a la meme heure » : a 10 h, on compare avec hier jusqu'a 10 h, pas avec
// la journee d'hier entiere (sinon le matin affiche toujours une forte baisse). Meme principe pour le mois.
const dashboard = asyncHandler(async (req, res) => {
  const now = new Date();
  const today = startOfDayDouala(now);
  const yesterday = new Date(today.getTime() - DAY_MS);
  const sameTimeYesterday = new Date(now.getTime() - DAY_MS);

  const monthStart = startOfMonthDouala(now);
  const lastMonthStart = startOfMonthDouala(now, 1);
  // Meme duree que le mois en cours, sans deborder sur le mois en cours (fevrier contre mars...).
  const lastMonthEnd = new Date(Math.min(lastMonthStart.getTime() + (now.getTime() - monthStart.getTime()), monthStart.getTime()));

  const range = (gte, lt) => ({ gte, ...(lt ? { lt } : {}) });
  const ordersIn = (gte, lt) => prisma.order.count({ where: { createdAt: range(gte, lt) } });
  const revenueIn = (gte, lt) =>
    prisma.order.aggregate({ where: { createdAt: range(gte, lt), status: { not: 'CANCELLED' } }, _sum: { total: true } });
  const clientsIn = (gte, lt) => prisma.customerProfile.count({ where: { createdAt: range(gte, lt) } });

  const [
    ordersToday,
    ordersYesterday,
    revenueTodayAgg,
    revenueYesterdayAgg,
    revenueMonthAgg,
    revenueLastMonthAgg,
    ordersInProgress,
    ordersPending,
    deliveriesInProgress,
    totalClients,
    newClientsMonth,
    newClientsLastMonth,
    driversByStatus,
    activeProductList,
    mobileMoneyToVerify,
  ] = await Promise.all([
    ordersIn(today),
    ordersIn(yesterday, sameTimeYesterday),
    revenueIn(today),
    revenueIn(yesterday, sameTimeYesterday),
    revenueIn(monthStart),
    revenueIn(lastMonthStart, lastMonthEnd),
    prisma.order.count({ where: { status: { in: IN_PROGRESS_STATUSES } } }),
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.delivery.count({ where: { status: { in: ['PICKED_UP', 'ON_ROUTE'] } } }),
    prisma.customerProfile.count(),
    clientsIn(monthStart),
    clientsIn(lastMonthStart, lastMonthEnd),
    prisma.driverProfile.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.product.findMany({
      where: { isActive: true },
      select: { stockQuantity: true, reservedQuantity: true, alertThreshold: true, variants: { where: { isActive: true }, select: { stockQuantity: true, reservedQuantity: true } } },
    }),
    // Paiements Mobile Money a verifier : tant que MTN / Orange ne sont pas branches, c'est
    // l'administration qui confirme chaque paiement (page « Paiements »).
    prisma.payment.count({
      where: { method: { in: ['MTN_MOMO', 'ORANGE_MONEY'] }, status: { in: ['PENDING', 'PROCESSING'] }, order: { status: { not: 'CANCELLED' } } },
    }),
  ]);

  const drivers = { available: 0, busy: 0, offline: 0, suspended: 0 };
  for (const g of driversByStatus) drivers[g.status.toLowerCase()] = g._count._all;

  // Produit a variantes : le disponible est la somme des pieces disponibles de ses variantes.
  const availableOf = (p) => (p.variants?.length ? p.variants.reduce((sum, v) => sum + v.stockQuantity - v.reservedQuantity, 0) : p.stockQuantity - p.reservedQuantity);
  const lowStockCount = activeProductList.filter((p) => p.alertThreshold > 0 && availableOf(p) <= p.alertThreshold).length;

  const revenueToday = revenueTodayAgg._sum.total || 0;
  const revenueYesterday = revenueYesterdayAgg._sum.total || 0;
  const revenueMonth = revenueMonthAgg._sum.total || 0;
  const revenueLastMonth = revenueLastMonthAgg._sum.total || 0;

  res.json({
    // Champs historiques (inchanges)
    ordersToday,
    revenueToday,
    ordersInProgress,
    ordersPending,
    totalClients,
    activeDrivers: drivers.available,
    activeProducts: activeProductList.length,
    // Ajouts : comparaisons, livraisons, stock, Mobile Money a verifier
    ordersYesterday,
    revenueYesterday,
    revenueMonth,
    revenueLastMonth,
    deliveriesInProgress,
    newClientsMonth,
    newClientsLastMonth,
    lowStockCount,
    mobileMoneyToVerify,
    drivers,
    deltas: {
      orders: percentChange(ordersToday, ordersYesterday),
      revenue: percentChange(revenueToday, revenueYesterday),
      revenueMonth: percentChange(revenueMonth, revenueLastMonth),
      newClients: percentChange(newClientsMonth, newClientsLastMonth),
    },
    asOf: now.toISOString(),
  });
});

// GET /api/statistics/sales?days=30 (section 53)
// `days` = nombre de jours affiches, aujourd'hui compris (30 jours = aujourd'hui + les 29 precedents).
// Un point par jour, y compris les jours sans vente : sinon le graphique relie des jours non consecutifs.
const sales = asyncHandler(async (req, res) => {
  const days = parseDays(req.query.days, 90) || 14;
  const since = daysAgo(days - 1);

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: since }, status: { not: 'CANCELLED' } },
    select: { total: true, createdAt: true },
  });

  const byDay = new Map();
  for (let i = 0; i < days; i += 1) byDay.set(formatDoualaDay(new Date(since.getTime() + i * DAY_MS)), { total: 0, orders: 0 });
  for (const o of orders) {
    const entry = byDay.get(formatDoualaDay(o.createdAt));
    if (entry) {
      entry.total += o.total;
      entry.orders += 1;
    }
  }

  const revenue = orders.reduce((sum, o) => sum + o.total, 0);
  const averageOrder = orders.length ? Math.round(revenue / orders.length) : 0;

  res.json({
    revenue,
    ordersCount: orders.length,
    averageOrder,
    days,
    dailyRevenue: [...byDay].map(([date, v]) => ({ date, total: v.total, orders: v.orders })),
  });
});

// GET /api/statistics/products?days=30&limit=5 (produits les plus/moins vendus - section 53)
// Sans `days` : depuis le debut. Sans `limit` : tous les produits.
const products = asyncHandler(async (req, res) => {
  const days = parseDays(req.query.days);
  const limit = parseDays(req.query.limit, 100);
  const grouped = await prisma.orderItem.groupBy({
    by: ['productId', 'name'],
    where: { order: { status: { not: 'CANCELLED' }, ...(days ? { createdAt: { gte: daysAgo(days - 1) } } : {}) } },
    _sum: { quantity: true, total: true },
    orderBy: { _sum: { total: 'desc' } },
    ...(limit ? { take: limit } : {}),
  });

  res.json(
    grouped.map((g) => ({
      productId: g.productId,
      name: g.name,
      quantitySold: g._sum.quantity,
      revenue: g._sum.total,
    }))
  );
});

// GET /api/statistics/zones (analyse geographique - section 54)
const zones = asyncHandler(async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { status: { not: 'CANCELLED' } },
    select: { total: true, deliveryFee: true, deliveryZone: { select: { name: true } } },
  });

  const byZone = {};
  for (const o of orders) {
    const key = o.deliveryZone?.name || 'Non definie';
    if (!byZone[key]) byZone[key] = { zone: key, ordersCount: 0, revenue: 0, deliveryFees: 0 };
    byZone[key].ordersCount += 1;
    byZone[key].revenue += o.total;
    byZone[key].deliveryFees += o.deliveryFee;
  }

  res.json(Object.values(byZone).sort((a, b) => b.ordersCount - a.ordersCount));
});

// ---------------------------------------------------------------------------
// STATISTIQUES AVANCEES / BUSINESS INTELLIGENCE (section 76)
// ---------------------------------------------------------------------------

// GET /api/statistics/profit-by-product - marges par produit (necessite costPrice)
const profitByProduct = asyncHandler(async (req, res) => {
  const items = await prisma.orderItem.findMany({
    where: { order: { status: { not: 'CANCELLED' } } },
    select: { productId: true, name: true, quantity: true, total: true, product: { select: { costPrice: true } } },
  });

  const map = {};
  for (const it of items) {
    if (!map[it.productId]) map[it.productId] = { productId: it.productId, name: it.name, revenue: 0, cost: 0, quantity: 0 };
    map[it.productId].revenue += it.total;
    map[it.productId].cost += Math.round((it.product?.costPrice || 0) * it.quantity);
    map[it.productId].quantity += it.quantity;
  }

  const results = Object.values(map).map((r) => ({
    ...r,
    profit: r.revenue - r.cost,
    marginPercent: r.revenue ? Math.round(((r.revenue - r.cost) / r.revenue) * 100) : 0,
  }));

  res.json(results.sort((a, b) => b.profit - a.profit));
});

// GET /api/statistics/top-customers - meilleurs clients (section 53)
const topCustomers = asyncHandler(async (req, res) => {
  const grouped = await prisma.order.groupBy({
    by: ['customerId'],
    where: { status: { not: 'CANCELLED' }, customerId: { not: null } },
    _sum: { total: true },
    _count: { _all: true },
    orderBy: { _sum: { total: 'desc' } },
    take: 20,
  });

  const customers = await prisma.customerProfile.findMany({
    where: { id: { in: grouped.map((g) => g.customerId) } },
    include: { user: { select: { firstName: true, lastName: true, phone: true } } },
  });

  res.json(
    grouped.map((g) => {
      const c = customers.find((x) => x.id === g.customerId);
      return {
        customerId: g.customerId,
        name: c ? `${c.user.firstName} ${c.user.lastName}` : 'Client',
        phone: c?.user?.phone,
        customerType: c?.customerType,
        ordersCount: g._count._all,
        totalSpent: g._sum.total || 0,
      };
    })
  );
});

// GET /api/statistics/driver-performance (section 76 "performances livreurs")
const driverPerformance = asyncHandler(async (req, res) => {
  const drivers = await prisma.driverProfile.findMany({
    include: {
      user: { select: { firstName: true, lastName: true } },
      deliveries: { where: { status: 'DELIVERED' }, select: { pickedUpAt: true, deliveredAt: true, cashExpected: true, cashReceived: true } },
    },
  });

  const results = drivers.map((d) => {
    const deliveries = d.deliveries;
    const durations = deliveries
      .filter((x) => x.pickedUpAt && x.deliveredAt)
      .map((x) => (new Date(x.deliveredAt) - new Date(x.pickedUpAt)) / 60000);
    const avgDeliveryMinutes = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;
    const cashIssues = deliveries.filter((x) => x.cashExpected != null && x.cashReceived != null && x.cashReceived < x.cashExpected).length;

    return {
      driverId: d.id,
      name: `${d.user.firstName} ${d.user.lastName}`,
      status: d.status,
      deliveriesCount: deliveries.length,
      avgDeliveryMinutes,
      cashIssues,
    };
  });

  res.json(results.sort((a, b) => b.deliveriesCount - a.deliveriesCount));
});

// GET /api/statistics/stock-forecast - prevision de rupture (section 76)
// Base sur la moyenne des ventes journalieres des 14 derniers jours : pas de
// machine learning, une simple moyenne mobile suffit a donner une alerte utile.
const stockForecast = asyncHandler(async (req, res) => {
  const windowDays = 14;
  const since = daysAgo(windowDays);

  const products = await prisma.product.findMany({ where: { isActive: true }, include: { variants: { where: { isActive: true } } } });
  const sales = await prisma.orderItem.findMany({
    where: { order: { createdAt: { gte: since }, status: { not: 'CANCELLED' } } },
    select: { productId: true, quantity: true },
  });

  const soldByProduct = {};
  for (const s of sales) soldByProduct[s.productId] = (soldByProduct[s.productId] || 0) + s.quantity;

  const results = products.map((p) => {
    const avgDaily = (soldByProduct[p.id] || 0) / windowDays;
    const available = p.variants?.length ? p.variants.reduce((sum, v) => sum + v.stockQuantity - v.reservedQuantity, 0) : p.stockQuantity - p.reservedQuantity;
    const daysUntilStockout = avgDaily > 0 ? Math.round((available / avgDaily) * 10) / 10 : null;
    return {
      productId: p.id,
      name: p.name,
      available,
      avgDailySales: Math.round(avgDaily * 100) / 100,
      daysUntilStockout,
      alert: daysUntilStockout !== null && daysUntilStockout <= 5,
    };
  });

  res.json(results.sort((a, b) => (a.daysUntilStockout ?? Infinity) - (b.daysUntilStockout ?? Infinity)));
});

// GET /api/statistics/anomalies - detection d'anomalies simple par ecart-type
// (section 76 "detection des anomalies") : signale les jours dont le nombre
// de commandes ou le CA s'ecarte fortement de la moyenne des 21 derniers jours.
const anomalies = asyncHandler(async (req, res) => {
  const windowDays = 21;
  const since = daysAgo(windowDays);

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: since } },
    select: { total: true, status: true, createdAt: true },
  });

  const byDay = {};
  for (const o of orders) {
    const key = formatDoualaDay(o.createdAt);
    if (!byDay[key]) byDay[key] = { date: key, ordersCount: 0, revenue: 0, cancelled: 0 };
    byDay[key].ordersCount += 1;
    if (o.status === 'CANCELLED') byDay[key].cancelled += 1;
    else byDay[key].revenue += o.total;
  }
  const days = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));

  const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const stddev = (arr, m) => (arr.length ? Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length) : 0);

  const ordersArr = days.map((d) => d.ordersCount);
  const revenueArr = days.map((d) => d.revenue);
  const ordersMean = mean(ordersArr);
  const ordersStd = stddev(ordersArr, ordersMean);
  const revenueMean = mean(revenueArr);
  const revenueStd = stddev(revenueArr, revenueMean);

  const flagged = days
    .map((d) => {
      const reasons = [];
      if (ordersStd > 0 && Math.abs(d.ordersCount - ordersMean) > 2 * ordersStd) {
        reasons.push(d.ordersCount > ordersMean ? 'Pic inhabituel de commandes' : 'Chute inhabituelle de commandes');
      }
      if (revenueStd > 0 && Math.abs(d.revenue - revenueMean) > 2 * revenueStd) {
        reasons.push(d.revenue > revenueMean ? 'Pic inhabituel de chiffre d\'affaires' : 'Chute inhabituelle de chiffre d\'affaires');
      }
      if (d.ordersCount > 0 && d.cancelled / d.ordersCount > 0.3) {
        reasons.push('Taux d\'annulation anormalement élevé');
      }
      return { ...d, reasons };
    })
    .filter((d) => d.reasons.length > 0);

  res.json({ baseline: { avgOrdersPerDay: Math.round(ordersMean * 10) / 10, avgRevenuePerDay: Math.round(revenueMean) }, anomalies: flagged });
});

// GET /api/statistics/payment-breakdown?days=30 - repartition des paiements encaisses par
// methode (camembert du tableau de bord admin, section 52-53). Sans `days` : depuis le debut.
const paymentBreakdown = asyncHandler(async (req, res) => {
  const days = parseDays(req.query.days);
  const grouped = await prisma.payment.groupBy({
    by: ['method'],
    where: { status: 'PAID', ...(days ? { createdAt: { gte: daysAgo(days - 1) } } : {}) },
    _count: { _all: true },
    _sum: { amount: true },
  });

  const total = grouped.reduce((sum, g) => sum + g._count._all, 0);

  res.json(
    grouped.map((g) => ({
      method: g.method,
      count: g._count._all,
      amount: g._sum.amount || 0,
      percent: total ? Math.round((g._count._all / total) * 100) : 0,
    }))
  );
});

module.exports = { dashboard, sales, products, zones, profitByProduct, topCustomers, driverPerformance, stockForecast, anomalies, paymentBreakdown };
