const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const { generateOrderNumber, generateDeliveryCode } = require('../utils/generators');
const { getUnitPriceForQuantity, computeCouponDiscount } = require('../utils/pricing');

/**
 * Cree une commande complete (adresse, lignes, reservation de stock, paiement,
 * livraison) a partir d'une entree normalisee. Utilise a la fois par le
 * controleur HTTP (commande passee par un client/invite) et par le job des
 * commandes recurrentes (section 75). Tous les prix sont recalcules a partir
 * de la base de donnees - jamais a partir d'une valeur transmise par l'appelant.
 *
 * @returns {Promise<string>} l'id de la commande creee
 */
async function createOrder({
  customerId = null,
  guestName = null,
  guestPhone = null,
  addressId = null,
  newAddress = null,
  deliveryZoneId,
  paymentMethod,
  paymentPhoneNumber = null,
  couponCode = null,
  scheduledAt = null,
  notes = null,
  items,
  originRecurringOrderId = null,
}) {
  if (!customerId && (!guestName || !guestPhone)) {
    throw new ApiError(400, 'Nom et telephone requis pour une commande sans compte');
  }
  if ((paymentMethod === 'MTN_MOMO' || paymentMethod === 'ORANGE_MONEY') && !paymentPhoneNumber) {
    throw new ApiError(400, 'Numero de telephone Mobile Money requis');
  }

  // --- Client (pour la remise grossiste eventuelle) ---
  const customer = customerId ? await prisma.customerProfile.findUnique({ where: { id: customerId } }) : null;

  // --- Adresse ---
  let address;
  if (addressId) {
    address = await prisma.address.findUnique({ where: { id: addressId } });
    if (!address) throw new ApiError(404, 'Adresse introuvable');
  } else if (newAddress) {
    address = await prisma.address.create({
      data: {
        fullName: newAddress.fullName,
        phone: newAddress.phone,
        region: newAddress.region || 'Centre',
        city: newAddress.city || 'Yaounde',
        district: newAddress.district,
        landmark: newAddress.landmark,
        instructions: newAddress.instructions,
        latitude: newAddress.latitude,
        longitude: newAddress.longitude,
        customerId: newAddress.saveAddress && customerId ? customerId : null,
      },
    });
  } else {
    throw new ApiError(400, 'Adresse de livraison requise');
  }

  // --- Zone de livraison ---
  const zone = await prisma.deliveryZone.findUnique({ where: { id: deliveryZoneId } });
  if (!zone || !zone.isActive) throw new ApiError(400, 'Zone de livraison invalide');
  const deliveryFee = zone.fee;

  // --- Lignes de commande (prix + stock recalcules cote serveur) ---
  const productIds = [...new Set(items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    include: { priceTiers: true },
  });

  const orderItemsData = [];
  let subtotal = 0;

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) throw new ApiError(404, `Produit introuvable ou indisponible (${item.productId})`);
    if (item.quantity < product.minOrderQuantity) {
      throw new ApiError(400, `Quantite minimum pour ${product.name} : ${product.minOrderQuantity}`);
    }
    const available = product.stockQuantity - product.reservedQuantity;
    if (item.quantity > available) {
      throw new ApiError(400, `Stock insuffisant pour ${product.name} (disponible : ${available})`);
    }

    const unitPrice = getUnitPriceForQuantity(product, item.quantity, customer);
    const total = Math.round(unitPrice * item.quantity);
    subtotal += total;

    orderItemsData.push({ productId: product.id, name: product.name, unitPrice, quantity: item.quantity, total });
  }

  // --- Coupon ---
  let coupon = null;
  let discount = 0;
  if (couponCode) {
    coupon = await prisma.coupon.findUnique({ where: { code: couponCode.trim().toUpperCase() } });
    if (!coupon || !coupon.isActive) throw new ApiError(400, 'Code promo invalide');
    if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new ApiError(400, 'Code promo expire');
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) throw new ApiError(400, 'Code promo epuise');
    if (subtotal < coupon.minOrderAmount) {
      throw new ApiError(400, `Montant minimum de ${coupon.minOrderAmount} FCFA requis pour ce code`);
    }
    discount = computeCouponDiscount(coupon, subtotal);
  }

  const total = subtotal + deliveryFee - discount;

  // --- Numero de commande sequentiel (base sur le nombre de commandes du jour) ---
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todaysCount = await prisma.order.count({ where: { createdAt: { gte: startOfDay } } });
  const orderNumber = generateOrderNumber(todaysCount + 1);

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber,
        customerId,
        guestName: customerId ? null : guestName,
        guestPhone: customerId ? null : guestPhone,
        addressId: address.id,
        deliveryZoneId: zone.id,
        couponId: coupon?.id,
        originRecurringOrderId,
        subtotal,
        deliveryFee,
        discount,
        total,
        status: 'PENDING',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        notes,
        items: { create: orderItemsData },
      },
    });

    for (const item of orderItemsData) {
      await tx.product.update({ where: { id: item.productId }, data: { reservedQuantity: { increment: item.quantity } } });
      await tx.stockMovement.create({
        data: { productId: item.productId, type: 'RESERVED', quantity: item.quantity, reason: `Commande ${orderNumber}` },
      });
    }

    await tx.orderStatusHistory.create({
      data: { orderId: created.id, status: 'PENDING', note: originRecurringOrderId ? 'Commande recurrente generee' : 'Commande recue' },
    });

    await tx.payment.create({
      data: { orderId: created.id, method: paymentMethod, amount: total, status: 'PENDING', phoneNumber: paymentPhoneNumber },
    });

    await tx.delivery.create({
      data: {
        orderId: created.id,
        status: 'PENDING',
        confirmationCode: generateDeliveryCode(),
        cashExpected: paymentMethod === 'CASH' ? total : null,
      },
    });

    if (coupon) {
      await tx.coupon.update({ where: { id: coupon.id }, data: { usageCount: { increment: 1 } } });
    }

    return created;
  });

  return order.id;
}

// Libere le stock reserve (annulation)
async function releaseStock(tx, order) {
  const orderItems = await tx.orderItem.findMany({ where: { orderId: order.id } });
  for (const item of orderItems) {
    await tx.product.update({ where: { id: item.productId }, data: { reservedQuantity: { decrement: item.quantity } } });
    await tx.stockMovement.create({
      data: { productId: item.productId, type: 'RELEASED', quantity: item.quantity, reason: `Annulation ${order.orderNumber}` },
    });
  }
}

// Deduit definitivement le stock, credite les points fidelite et le bonus de
// parrainage eventuel (premiere commande livree d'un filleul).
async function finalizeDelivery(tx, order) {
  const orderItems = await tx.orderItem.findMany({ where: { orderId: order.id } });
  for (const item of orderItems) {
    await tx.product.update({
      where: { id: item.productId },
      data: { stockQuantity: { decrement: item.quantity }, reservedQuantity: { decrement: item.quantity } },
    });
    await tx.stockMovement.create({
      data: { productId: item.productId, type: 'OUT', quantity: item.quantity, reason: `Livraison ${order.orderNumber}` },
    });
  }

  if (!order.customerId) return;

  const points = Math.floor(order.total / 1000);
  if (points > 0) {
    await tx.customerProfile.update({ where: { id: order.customerId }, data: { loyaltyPoints: { increment: points } } });
  }

  // Bonus de parrainage : au premier achat livre d'un filleul, le parrain
  // recoit un bonus de points (section 77, programme de parrainage).
  const customer = await tx.customerProfile.findUnique({ where: { id: order.customerId } });
  if (customer?.referredById) {
    const deliveredCount = await tx.order.count({ where: { customerId: order.customerId, status: 'DELIVERED' } });
    if (deliveredCount === 1) {
      await tx.customerProfile.update({ where: { id: customer.referredById }, data: { loyaltyPoints: { increment: 50 } } });
    }
  }
}

module.exports = { createOrder, releaseStock, finalizeDelivery };
