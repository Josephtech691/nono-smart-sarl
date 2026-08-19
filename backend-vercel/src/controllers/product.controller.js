const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { slugify } = require('./category.controller');
const { notifyAdmins } = require('../utils/notify');

const PUBLIC_INCLUDE = {
  images: { orderBy: { position: 'asc' } },
  priceTiers: { orderBy: { minQuantity: 'asc' } },
  category: true,
};

// GET /api/products?category=&search=&page=&limit=&featured=
const listProducts = asyncHandler(async (req, res) => {
  const { category, search, featured, page = '1', limit = '20', all } = req.query;
  const showInactive = all === 'true' && req.user?.role === 'ADMIN';

  const where = {
    ...(showInactive ? {} : { isActive: true }),
    ...(category ? { category: { slug: category } } : {}),
    ...(featured === 'true' ? { isFeatured: true } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const take = Math.min(Number(limit) || 20, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [items, total] = await Promise.all([
    prisma.product.findMany({ where, include: PUBLIC_INCLUDE, orderBy: { createdAt: 'desc' }, take, skip }),
    prisma.product.count({ where }),
  ]);

  res.json({ items, total, page: Number(page) || 1, limit: take });
});

// GET /api/products/:idOrSlug (public)
const getProduct = asyncHandler(async (req, res) => {
  const { idOrSlug } = req.params;
  const product = await prisma.product.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: {
      ...PUBLIC_INCLUDE,
      reviews: { where: { isVisible: true }, orderBy: { createdAt: 'desc' }, take: 10 },
    },
  });
  if (!product) throw new ApiError(404, 'Produit introuvable');
  res.json(product);
});

// POST /api/products (admin)
const createProduct = asyncHandler(async (req, res) => {
  const { name, description, price, costPrice, unit, categoryId, stockQuantity, alertThreshold, minOrderQuantity, isActive, isFeatured, images, priceTiers } = req.body;

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new ApiError(400, 'Categorie invalide');

  let slug = slugify(name);
  const clash = await prisma.product.findUnique({ where: { slug } });
  if (clash) slug = `${slug}-${Date.now().toString().slice(-4)}`;

  const product = await prisma.product.create({
    data: {
      name,
      slug,
      description,
      price,
      costPrice: costPrice ?? 0,
      unit,
      categoryId,
      stockQuantity: stockQuantity ?? 0,
      alertThreshold: alertThreshold ?? 0,
      minOrderQuantity: minOrderQuantity ?? 1,
      isActive: isActive ?? true,
      isFeatured: isFeatured ?? false,
      images: images?.length ? { create: images.map((url, i) => ({ url, position: i })) } : undefined,
      priceTiers: priceTiers?.length ? { create: priceTiers } : undefined,
    },
    include: PUBLIC_INCLUDE,
  });

  res.status(201).json(product);
});

// PATCH /api/products/:id (admin)
const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'Produit introuvable');

  const { images, priceTiers, ...fields } = req.body;

  const product = await prisma.$transaction(async (tx) => {
    if (images) {
      await tx.productImage.deleteMany({ where: { productId: id } });
      if (images.length) {
        await tx.productImage.createMany({ data: images.map((url, i) => ({ productId: id, url, position: i })) });
      }
    }
    if (priceTiers) {
      await tx.productPriceTier.deleteMany({ where: { productId: id } });
      if (priceTiers.length) {
        await tx.productPriceTier.createMany({ data: priceTiers.map((t) => ({ ...t, productId: id })) });
      }
    }
    return tx.product.update({ where: { id }, data: fields, include: PUBLIC_INCLUDE });
  });

  res.json(product);
});

// DELETE /api/products/:id (admin) - desactivation (soft delete)
const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'Produit introuvable');
  await prisma.product.update({ where: { id }, data: { isActive: false } });
  res.json({ message: 'Produit desactive' });
});

// PATCH /api/products/:id/stock (admin) - ajustement manuel de stock (section 31)
const adjustStock = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { quantity, reason } = req.body; // quantity peut etre positif (entree) ou negatif (sortie/perte)
  if (typeof quantity !== 'number' || quantity === 0) {
    throw new ApiError(400, 'Quantite invalide');
  }

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new ApiError(404, 'Produit introuvable');

  const newStock = product.stockQuantity + quantity;
  if (newStock < 0) throw new ApiError(400, 'Le stock ne peut pas devenir negatif');

  const [updated] = await prisma.$transaction([
    prisma.product.update({ where: { id }, data: { stockQuantity: newStock }, include: PUBLIC_INCLUDE }),
    prisma.stockMovement.create({
      data: {
        productId: id,
        type: quantity > 0 ? 'IN' : 'ADJUSTMENT',
        quantity: Math.abs(quantity),
        reason: reason || 'Ajustement manuel',
      },
    }),
  ]);

  if (updated.stockQuantity - updated.reservedQuantity <= updated.alertThreshold && updated.alertThreshold > 0) {
    await notifyAdmins({
      title: 'Stock faible',
      message: `${updated.name} : stock restant ${updated.stockQuantity - updated.reservedQuantity} (seuil ${updated.alertThreshold})`,
      link: `/admin/products`,
    });
  }

  res.json(updated);
});

// GET /api/products/:id/recommendations - "les clients ont aussi acheté"
// (section 76 "recommandations"). Base sur la co-occurrence dans les
// commandes passees ; se rabat sur la meme categorie si pas encore assez de
// donnees (demarrage a froid).
const getRecommendations = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new ApiError(404, 'Produit introuvable');

  const orderIds = (await prisma.orderItem.findMany({ where: { productId: id }, select: { orderId: true } })).map((x) => x.orderId);

  let recommended = [];
  if (orderIds.length) {
    const coItems = await prisma.orderItem.findMany({
      where: { orderId: { in: orderIds }, productId: { not: id } },
      select: { productId: true },
    });
    const freq = {};
    coItems.forEach((i) => { freq[i.productId] = (freq[i.productId] || 0) + 1; });
    const topIds = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([pid]) => pid);
    if (topIds.length) {
      recommended = await prisma.product.findMany({ where: { id: { in: topIds }, isActive: true }, include: PUBLIC_INCLUDE });
    }
  }

  if (recommended.length < 4) {
    const fallback = await prisma.product.findMany({
      where: { categoryId: product.categoryId, id: { not: id, notIn: recommended.map((p) => p.id) }, isActive: true },
      include: PUBLIC_INCLUDE,
      take: 4 - recommended.length,
    });
    recommended = [...recommended, ...fallback];
  }

  res.json(recommended);
});

module.exports = { listProducts, getProduct, createProduct, updateProduct, deleteProduct, adjustStock, getRecommendations };
