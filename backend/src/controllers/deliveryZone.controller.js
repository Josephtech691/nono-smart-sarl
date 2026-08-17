const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/delivery-zones (public - necessaire au calcul des frais au panier)
const listZones = asyncHandler(async (req, res) => {
  const onlyActive = req.query.all !== 'true';
  const zones = await prisma.deliveryZone.findMany({
    where: onlyActive ? { isActive: true } : undefined,
    orderBy: { fee: 'asc' },
  });
  res.json(zones);
});

const createZone = asyncHandler(async (req, res) => {
  const zone = await prisma.deliveryZone.create({ data: req.body });
  res.status(201).json(zone);
});

const updateZone = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await prisma.deliveryZone.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'Zone introuvable');
  const zone = await prisma.deliveryZone.update({ where: { id }, data: req.body });
  res.json(zone);
});

const deleteZone = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await prisma.deliveryZone.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'Zone introuvable');
  await prisma.deliveryZone.update({ where: { id }, data: { isActive: false } });
  res.json({ message: 'Zone desactivee' });
});

module.exports = { listZones, createZone, updateZone, deleteZone };
