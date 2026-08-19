const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

// GET /api/statistics/dashboard (section 52)
const dashboard = asyncHandler(async (req, res) => {
  const today = startOfToday();

  const [
    ordersToday,
    revenueTodayAgg,
    ordersInProgress,
    ordersPending,
    totalClients,
    activeDrivers,
    lowStockCount,
  ] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: today } } }),
    prisma.order.aggregate({
      where: { createdAt: { gte: today }, status: { not: 'CANCELLED' } },
      _sum: { total: true },
    }),
    prisma.order.count({ where: { status: { in: ['CONFIRMED', 'PREPARING', 'READY', 'ASSIGNED', 'PICKED_UP', 'ON_DELIVERY'] } } }),
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.customerProfile.count(),
    prisma.driverProfile.count({ where: { status: 'AVAILABLE' } }),
    prisma.product.count({ where: { isActive: true } }),
  ]);

  res.json({
    ordersToday,
    revenueToday: revenueTodayAgg._sum.total || 0,
    ordersInProgress,
    ordersPending,
    totalClients,
    activeDrivers,
    activeProducts: lowStockCount,
  });
});

// GET /api/statistics/sales?days=30 (section 53)
const sales = asyncHandler(async (req, res) => {
  const days = Math.min(Number(req.query.days) || 14, 90);
  const since = daysAgo(days);

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: since }, status: { not: 'CANCELLED' } },
    select: { total: true, createdAt: true },
  });

  const byDay = {};
  for (const o of orders) {
    const key = o.createdAt.toISOString().slice(0, 10);
    byDay[key] = (byDay[key] || 0) + o.total;
  }

  const revenue = orders.reduce((sum, o) => sum + o.total, 0);
  const averageOrder = orders.length ? Math.round(revenue / orders.length) : 0;

  res.json({
    revenue,
    ordersCount: orders.length,
    averageOrder,
    dailyRevenue: Object.entries(byDay).map(([date, total]) => ({ date, total })).sort((a, b) => a.date.localeCompare(b.date)),
  });
});

// GET /api/statistics/products (produits les plus/moins vendus - section 53)
const products = asyncHandler(async (req, res) => {
  const grouped = await prisma.orderItem.groupBy({
    by: ['productId', 'name'],
    _sum: { quantity: true, total: true },
    orderBy: { _sum: { total: 'desc' } },
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

  const products = await prisma.product.findMany({ where: { isActive: true } });
  const sales = await prisma.orderItem.findMany({
    where: { order: { createdAt: { gte: since }, status: { not: 'CANCELLED' } } },
    select: { productId: true, quantity: true },
  });

  const soldByProduct = {};
  for (const s of sales) soldByProduct[s.productId] = (soldByProduct[s.productId] || 0) + s.quantity;

  const results = products.map((p) => {
    const avgDaily = (soldByProduct[p.id] || 0) / windowDays;
    const available = p.stockQuantity - p.reservedQuantity;
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
    const key = o.createdAt.toISOString().slice(0, 10);
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

module.exports = { dashboard, sales, products, zones, profitByProduct, topCustomers, driverPerformance, stockForecast, anomalies };
