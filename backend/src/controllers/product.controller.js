const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { slugify } = require('./category.controller');
const { notifyAdmins } = require('../utils/notify');

const PUBLIC_INCLUDE = {
  images: { orderBy: { position: 'asc' } },
  priceTiers: { orderBy: { minQuantity: 'asc' } },
  variants: { where: { isActive: true }, orderBy: { position: 'asc' } },
  category: true,
};

// Vue administration : toutes les variantes, y compris celles qui sont desactivees.
const ADMIN_INCLUDE = { ...PUBLIC_INCLUDE, variants: { orderBy: { position: 'asc' } } };

// Enregistre la liste des variantes envoyee par l'administration : met a jour celles qui existent (par id), cree les
// nouvelles, et retire les absentes (supprimees si jamais commandees, sinon desactivees pour garder l'historique).
async function syncVariants(tx, productId, variants) {
  const existing = await tx.productVariant.findMany({ where: { productId } });
  const keep = new Set();

  for (let i = 0; i < variants.length; i += 1) {
    const v = variants[i];
    const data = { label: v.label.trim(), price: v.price, imageUrl: v.imageUrl || null, position: i, isActive: v.isActive ?? true };
    const current = v.id ? existing.find((e) => e.id === v.id) : null;

    if (current) {
      keep.add(current.id);
      if (v.stockQuantity !== undefined) data.stockQuantity = v.stockQuantity;
      await tx.productVariant.update({ where: { id: current.id }, data });
      if (v.stockQuantity !== undefined && v.stockQuantity !== current.stockQuantity) {
        const diff = v.stockQuantity - current.stockQuantity;
        await tx.stockMovement.create({
          data: { productId, type: diff > 0 ? 'IN' : 'ADJUSTMENT', quantity: Math.abs(diff), reason: `Ajustement ${data.label}` },
        });
      }
    } else {
      const created = await tx.productVariant.create({ data: { ...data, stockQuantity: v.stockQuantity ?? 0, productId } });
      keep.add(created.id);
      if (created.stockQuantity > 0) {
        await tx.stockMovement.create({ data: { productId, type: 'IN', quantity: created.stockQuantity, reason: `Stock initial ${created.label}` } });
      }
    }
  }

  for (const gone of existing.filter((e) => !keep.has(e.id))) {
    const used = await tx.orderItem.count({ where: { variantId: gone.id } });
    if (used > 0) await tx.productVariant.update({ where: { id: gone.id }, data: { isActive: false } });
    else await tx.productVariant.delete({ where: { id: gone.id } });
  }
}

// Prix « a partir de » d'un produit a variantes = le plus bas prix parmi les variantes actives.
const lowestVariantPrice = (variants) => {
  const active = variants.filter((v) => v.isActive !== false);
  return Math.min(...(active.length ? active : variants).map((v) => v.price));
};

// Tris proposes au catalogue (?sort=). "relevance" met les produits phares en premier.
const PRODUCT_SORTS = {
  relevance: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
  newest: [{ createdAt: 'desc' }],
  price_asc: [{ price: 'asc' }, { name: 'asc' }],
  price_desc: [{ price: 'desc' }, { name: 'asc' }],
  name: [{ name: 'asc' }],
};

// GET /api/products?category=&search=&sort=&page=&limit=&featured=
const listProducts = asyncHandler(async (req, res) => {
  const { category, search, featured, sort, minPrice, maxPrice, inStock, page = '1', limit = '20', all } = req.query;
  const showInactive = all === 'true' && req.user?.role === 'ADMIN';

  const where = {
    ...(showInactive ? {} : { isActive: true }),
    ...(category ? { category: { slug: category } } : {}),
    ...(featured === 'true' ? { isFeatured: true } : {}),
    // Filtre de prix sur le prix de base ("a partir de"). NaN / valeurs vides ignorees.
    ...(Number.isFinite(Number(minPrice)) && minPrice !== undefined && minPrice !== '' ? { price: { gte: Math.round(Number(minPrice)) } } : {}),
    // "En stock" : stock physique > 0 (le detail d'un produit tient compte des quantites reservees).
    ...(inStock === 'true' ? { OR: [{ stockQuantity: { gt: 0 } }, { variants: { some: { isActive: true, stockQuantity: { gt: 0 } } } }] } : {}),
    ...(search
      ? {
          AND: [
            {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
              ],
            },
          ],
        }
      : {}),
  };

  if (maxPrice !== undefined && maxPrice !== '' && Number.isFinite(Number(maxPrice))) {
    where.price = { ...(where.price || {}), lte: Math.round(Number(maxPrice)) };
  }

  const take = Math.min(Number(limit) || 20, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [items, total] = await Promise.all([
    prisma.product.findMany({ where, include: showInactive ? ADMIN_INCLUDE : PUBLIC_INCLUDE, orderBy: PRODUCT_SORTS[sort] || PRODUCT_SORTS.relevance, take, skip }),
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
      reviews: {
        where: { isVisible: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { customer: { select: { user: { select: { firstName: true, lastName: true } } } } },
      },
    },
  });
  if (!product) throw new ApiError(404, 'Produit introuvable');

  const stats = await prisma.review.aggregate({
    where: { productId: product.id, isVisible: true },
    _count: { _all: true },
    _avg: { quality: true, delivery: true, service: true },
  });
  const avgParts = [stats._avg.quality, stats._avg.delivery, stats._avg.service].filter((n) => n != null);
  const reviewStats = {
    count: stats._count._all,
    average: avgParts.length ? Math.round((avgParts.reduce((a, b) => a + b, 0) / avgParts.length) * 10) / 10 : 0,
  };

  // Avis publics : on n'expose que "Prenom + initiale du nom" (jamais le nom complet ni l'identifiant client).
  const reviews = product.reviews.map(({ customer, customerId, ...review }) => {
    const first = customer?.user?.firstName || 'Client';
    const initial = customer?.user?.lastName ? ` ${customer.user.lastName.charAt(0).toUpperCase()}.` : '';
    return { ...review, authorName: `${first}${initial}` };
  });

  res.json({ ...product, reviews, reviewStats });
});

// POST /api/products (admin)
const createProduct = asyncHandler(async (req, res) => {
  const { name, description, price, costPrice, unit, categoryId, stockQuantity, alertThreshold, minOrderQuantity, isActive, isFeatured, images, priceTiers, variants } = req.body;
  const hasVariants = Array.isArray(variants) && variants.length > 0;
  if (!hasVariants && !price) throw new ApiError(400, 'Le prix de vente est requis');

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
      price: hasVariants ? lowestVariantPrice(variants) : price,
      costPrice: costPrice ?? 0,
      unit,
      categoryId,
      stockQuantity: stockQuantity ?? 0,
      alertThreshold: alertThreshold ?? 0,
      minOrderQuantity: minOrderQuantity ?? 1,
      isActive: isActive ?? true,
      isFeatured: isFeatured ?? false,
      images: images?.length ? { create: images.map((url, i) => ({ url, position: i, altText: name })) } : undefined,
      priceTiers: priceTiers?.length && !hasVariants ? { create: priceTiers } : undefined,
      variants: hasVariants
        ? {
            create: variants.map((v, i) => ({
              label: v.label.trim(),
              price: v.price,
              imageUrl: v.imageUrl || null,
              stockQuantity: v.stockQuantity ?? 0,
              position: i,
              isActive: v.isActive ?? true,
            })),
          }
        : undefined,
    },
    include: ADMIN_INCLUDE,
  });

  res.status(201).json(product);
});

// PATCH /api/products/:id (admin)
const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'Produit introuvable');

  const { images, priceTiers, variants, ...fields } = req.body;

  const product = await prisma.$transaction(async (tx) => {
    if (images) {
      // Les photos sont recreees a chaque enregistrement : on garde le texte alternatif de celles qui existaient deja.
      const previous = await tx.productImage.findMany({ where: { productId: id } });
      const altByUrl = new Map(previous.map((image) => [image.url, image.altText]));
      await tx.productImage.deleteMany({ where: { productId: id } });
      if (images.length) {
        await tx.productImage.createMany({
          data: images.map((url, i) => ({ productId: id, url, position: i, altText: altByUrl.get(url) || fields.name || existing.name })),
        });
      }
    }
    if (variants) {
      await syncVariants(tx, id, variants);
      // Produit a variantes : le prix « a partir de » suit le plus bas prix de variante, et les paliers ne s'appliquent plus.
      if (variants.length) {
        fields.price = lowestVariantPrice(variants);
        await tx.productPriceTier.deleteMany({ where: { productId: id } });
      }
    }
    if (priceTiers && !(variants && variants.length)) {
      await tx.productPriceTier.deleteMany({ where: { productId: id } });
      if (priceTiers.length) {
        await tx.productPriceTier.createMany({ data: priceTiers.map((t) => ({ ...t, productId: id })) });
      }
    }
    return tx.product.update({ where: { id }, data: fields, include: ADMIN_INCLUDE });
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
// `variantId` : ajuste le stock d'une variante (pieces) au lieu de celui du produit.
const adjustStock = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { quantity, reason, variantId } = req.body; // quantity peut etre positif (entree) ou negatif (sortie/perte)
  if (typeof quantity !== 'number' || quantity === 0) {
    throw new ApiError(400, 'Quantite invalide');
  }

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new ApiError(404, 'Produit introuvable');

  let variant = null;
  if (variantId) {
    variant = await prisma.productVariant.findFirst({ where: { id: variantId, productId: id } });
    if (!variant) throw new ApiError(404, 'Variante introuvable');
  }
  const source = variant || product;

  const newStock = source.stockQuantity + quantity;
  if (newStock < 0) throw new ApiError(400, 'Le stock ne peut pas devenir negatif');

  const label = variant ? ` (${variant.label})` : '';
  await prisma.$transaction([
    variant
      ? prisma.productVariant.update({ where: { id: variant.id }, data: { stockQuantity: newStock } })
      : prisma.product.update({ where: { id }, data: { stockQuantity: newStock } }),
    prisma.stockMovement.create({
      data: {
        productId: id,
        type: quantity > 0 ? 'IN' : 'ADJUSTMENT',
        quantity: Math.abs(quantity),
        reason: `${reason || 'Ajustement manuel'}${label}`,
      },
    }),
  ]);

  const updated = await prisma.product.findUnique({ where: { id }, include: ADMIN_INCLUDE });
  const stillSource = variant ? updated.variants.find((v) => v.id === variant.id) : updated;
  if (stillSource.stockQuantity - stillSource.reservedQuantity <= updated.alertThreshold && updated.alertThreshold > 0) {
    await notifyAdmins({
      title: 'Stock faible',
      message: `${updated.name}${label} : stock restant ${stillSource.stockQuantity - stillSource.reservedQuantity} (seuil ${updated.alertThreshold})`,
      link: `/admin/produits`,
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
