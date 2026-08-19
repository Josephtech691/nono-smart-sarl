const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { computeCouponDiscount } = require('../utils/pricing');

// POST /api/coupons/validate - utilise au panier/checkout pour previsualiser
// la reduction avant de creer la commande (le calcul final est toujours
// refait cote serveur dans order.controller.createOrder)
const validateCoupon = asyncHandler(async (req, res) => {
  const { code, subtotal } = req.body;
  const coupon = await prisma.coupon.findUnique({ where: { code: String(code).trim().toUpperCase() } });

  if (!coupon || !coupon.isActive) throw new ApiError(404, 'Code promo invalide');
  if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new ApiError(400, 'Code promo expire');
  if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) throw new ApiError(400, 'Code promo epuise');
  if (subtotal < coupon.minOrderAmount) {
    throw new ApiError(400, `Montant minimum de ${coupon.minOrderAmount} FCFA requis`);
  }

  res.json({ code: coupon.code, discount: computeCouponDiscount(coupon, subtotal) });
});

// admin
const listCoupons = asyncHandler(async (req, res) => {
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(coupons);
});

const createCoupon = asyncHandler(async (req, res) => {
  const data = { ...req.body, code: req.body.code.trim().toUpperCase() };
  if (data.expiresAt) data.expiresAt = new Date(data.expiresAt);
  const coupon = await prisma.coupon.create({ data });
  res.status(201).json(coupon);
});

const updateCoupon = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = { ...req.body };
  if (data.expiresAt) data.expiresAt = new Date(data.expiresAt);
  const coupon = await prisma.coupon.update({ where: { id }, data });
  res.json(coupon);
});

module.exports = { validateCoupon, listCoupons, createCoupon, updateCoupon };
