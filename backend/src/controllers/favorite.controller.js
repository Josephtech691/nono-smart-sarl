const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

const listMyFavorites = asyncHandler(async (req, res) => {
  const favorites = await prisma.favorite.findMany({
    where: { customerId: req.customerProfile.id },
    include: { product: { include: { images: true, priceTiers: true, variants: { where: { isActive: true }, orderBy: { position: 'asc' } } } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(favorites);
});

const addFavorite = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  const favorite = await prisma.favorite.upsert({
    where: { customerId_productId: { customerId: req.customerProfile.id, productId } },
    update: {},
    create: { customerId: req.customerProfile.id, productId },
  });
  res.status(201).json(favorite);
});

const removeFavorite = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  await prisma.favorite.deleteMany({ where: { customerId: req.customerProfile.id, productId } });
  res.json({ message: 'Retire des favoris' });
});

module.exports = { listMyFavorites, addFavorite, removeFavorite };
