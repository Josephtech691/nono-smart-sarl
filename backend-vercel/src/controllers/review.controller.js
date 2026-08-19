const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// POST /api/orders/:id/review (section 45) - uniquement apres livraison
const createReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { quality, delivery, service, comment } = req.body;

  const order = await prisma.order.findUnique({ where: { id }, include: { review: true, items: true } });
  if (!order) throw new ApiError(404, 'Commande introuvable');
  if (order.customerId !== req.customerProfile.id) throw new ApiError(403, 'Acces refuse');
  if (order.status !== 'DELIVERED') throw new ApiError(400, 'Vous ne pouvez noter que les commandes livrees');
  if (order.review) throw new ApiError(409, 'Cette commande a deja ete notee');

  const review = await prisma.review.create({
    data: {
      orderId: id,
      customerId: req.customerProfile.id,
      productId: order.items[0]?.productId,
      quality,
      delivery,
      service,
      comment,
    },
  });
  res.status(201).json(review);
});

// GET /api/reviews (admin - moderation, section 45) ou /api/reviews?productId= (public)
const listReviews = asyncHandler(async (req, res) => {
  const { productId } = req.query;
  const isAdmin = req.user?.role === 'ADMIN';

  const reviews = await prisma.review.findMany({
    where: {
      ...(productId ? { productId } : {}),
      ...(isAdmin ? {} : { isVisible: true }),
    },
    include: { customer: { include: { user: { select: { firstName: true, lastName: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(reviews);
});

// PATCH /api/reviews/:id (admin) - masquer un avis inapproprie
const moderateReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isVisible } = req.body;
  const review = await prisma.review.update({ where: { id }, data: { isVisible } });
  res.json(review);
});

module.exports = { createReview, listReviews, moderateReview };
