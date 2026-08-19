const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { computeNextRunAt } = require('../utils/generators');

// GET /api/recurring-orders (mine)
const listMine = asyncHandler(async (req, res) => {
  const recurring = await prisma.recurringOrder.findMany({
    where: { customerId: req.customerProfile.id },
    include: { address: true, deliveryZone: true, generatedOrders: { orderBy: { createdAt: 'desc' }, take: 3 } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(recurring);
});

// POST /api/recurring-orders
const create = asyncHandler(async (req, res) => {
  const { label, items, addressId, deliveryZoneId, paymentMethod, frequency, startDate } = req.body;

  if (!Array.isArray(items) || items.length === 0) throw new ApiError(400, 'Le panier de la commande recurrente est vide');

  const [address, zone] = await Promise.all([
    prisma.address.findUnique({ where: { id: addressId } }),
    prisma.deliveryZone.findUnique({ where: { id: deliveryZoneId } }),
  ]);
  if (!address || address.customerId !== req.customerProfile.id) throw new ApiError(400, 'Adresse invalide');
  if (!zone || !zone.isActive) throw new ApiError(400, 'Zone de livraison invalide');

  const recurring = await prisma.recurringOrder.create({
    data: {
      customerId: req.customerProfile.id,
      label,
      items,
      addressId,
      deliveryZoneId,
      paymentMethod,
      frequency,
      nextRunAt: startDate ? new Date(startDate) : computeNextRunAt(frequency),
    },
  });
  res.status(201).json(recurring);
});

// PATCH /api/recurring-orders/:id (activer/desactiver, changer la frequence)
const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await prisma.recurringOrder.findUnique({ where: { id } });
  if (!existing || existing.customerId !== req.customerProfile.id) throw new ApiError(404, 'Commande recurrente introuvable');

  const data = {};
  if (typeof req.body.isActive === 'boolean') data.isActive = req.body.isActive;
  if (req.body.frequency) {
    data.frequency = req.body.frequency;
    data.nextRunAt = computeNextRunAt(req.body.frequency);
  }
  if (req.body.label !== undefined) data.label = req.body.label;

  const recurring = await prisma.recurringOrder.update({ where: { id }, data });
  res.json(recurring);
});

const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await prisma.recurringOrder.findUnique({ where: { id } });
  if (!existing || existing.customerId !== req.customerProfile.id) throw new ApiError(404, 'Commande recurrente introuvable');
  await prisma.recurringOrder.delete({ where: { id } });
  res.json({ message: 'Commande récurrente supprimée' });
});

module.exports = { listMine, create, update, remove };
