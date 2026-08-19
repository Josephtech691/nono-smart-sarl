const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

function slugify(text) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// GET /api/categories (public)
const listCategories = asyncHandler(async (req, res) => {
  const onlyActive = req.query.all !== 'true';
  const categories = await prisma.category.findMany({
    where: onlyActive ? { isActive: true } : undefined,
    orderBy: { position: 'asc' },
    include: { _count: { select: { products: true } } },
  });
  res.json(categories);
});

// POST /api/categories (admin)
const createCategory = asyncHandler(async (req, res) => {
  const { name, description, isActive } = req.body;
  let slug = slugify(name);
  const clash = await prisma.category.findUnique({ where: { slug } });
  if (clash) slug = `${slug}-${Date.now().toString().slice(-4)}`;

  const category = await prisma.category.create({
    data: { name, slug, description, isActive: isActive ?? true },
  });
  res.status(201).json(category);
});

// PATCH /api/categories/:id (admin)
const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'Categorie introuvable');

  const category = await prisma.category.update({
    where: { id },
    data: req.body,
  });
  res.json(category);
});

// DELETE /api/categories/:id (admin) - desactivation plutot que suppression
// physique, pour ne pas casser les commandes historiques qui referencent des
// produits de cette categorie.
const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'Categorie introuvable');

  await prisma.category.update({ where: { id }, data: { isActive: false } });
  res.json({ message: 'Categorie desactivee' });
});

module.exports = { listCategories, createCategory, updateCategory, deleteCategory, slugify };
