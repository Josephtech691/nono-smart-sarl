const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/addresses (mine)
const listMyAddresses = asyncHandler(async (req, res) => {
  const addresses = await prisma.address.findMany({
    where: { customerId: req.customerProfile.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
  res.json(addresses);
});

const createAddress = asyncHandler(async (req, res) => {
  const data = { ...req.body, customerId: req.customerProfile.id };
  if (data.isDefault) {
    await prisma.address.updateMany({ where: { customerId: req.customerProfile.id }, data: { isDefault: false } });
  }
  const address = await prisma.address.create({ data });
  res.status(201).json(address);
});

const updateAddress = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await prisma.address.findUnique({ where: { id } });
  if (!existing || existing.customerId !== req.customerProfile.id) throw new ApiError(404, 'Adresse introuvable');

  if (req.body.isDefault) {
    await prisma.address.updateMany({ where: { customerId: req.customerProfile.id }, data: { isDefault: false } });
  }
  const address = await prisma.address.update({ where: { id }, data: req.body });
  res.json(address);
});

const deleteAddress = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await prisma.address.findUnique({ where: { id } });
  if (!existing || existing.customerId !== req.customerProfile.id) throw new ApiError(404, 'Adresse introuvable');
  await prisma.address.delete({ where: { id } });
  res.json({ message: 'Adresse supprimee' });
});

module.exports = { listMyAddresses, createAddress, updateAddress, deleteAddress };
