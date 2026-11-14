const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const { generateOrderNumber, generateDeliveryCode } = require('../utils/generators');
const { getUnitPriceForQuantity, computeCouponDiscount } = require('../utils/pricing');
const { startOfDayDouala } = require('../utils/time');
const { assertCashAllowed } = require('./cash.service');
const { FLAT_DELIVERY_FEE } = require('../config/delivery');

// Reserve (delta > 0) ou libere (delta < 0) du stock : sur la variante si la ligne en a une, sinon sur le produit.
async function adjustReserved(tx, item, delta) {
  if (item.variantId) {
    return tx.productVariant.update({ where: { id: item.variantId }, data: { reservedQuantity: { increment: delta } } });
  }
  return tx.product.update({ where: { id: item.productId }, data: { reservedQuantity: { increment: delta } } });
}

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
  deliveryZoneId = null,
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
  // Especes : reserve aux clients avec compte ayant deja paye plus de 2 commandes par Mobile Money.
  if (paymentMethod === 'CASH') await assertCashAllowed(customerId);

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

  // --- Livraison : tarif unique (FLAT_DELIVERY_FEE), la zone n'influence plus le prix ---
  // Si une zone est transmise (anciens clients de l'API, commandes recurrentes existantes) et valide, on la garde
  // a titre d'information ; sinon la commande n'a pas de zone.
  let zone = null;
  if (deliveryZoneId) {
    zone = await prisma.deliveryZone.findUnique({ where: { id: deliveryZoneId } });
    if (zone && !zone.isActive) zone = null;
  }
  const deliveryFee = FLAT_DELIVERY_FEE;

  // --- Lignes de commande (prix + stock recalcules cote serveur) ---
  const productIds = [...new Set(items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    include: { priceTiers: true, variants: true },
  });
  // Prix speciaux fixes par l'administration pour ce client.
  const specialPrices = customerId
    ? await prisma.customerProductPrice.findMany({ where: { customerId, productId: { in: productIds } } })
    : [];

  const orderItemsData = [];
  let subtotal = 0;
  // Quantite deja demandee par produit / variante dans cette commande (une meme ligne peut etre envoyee deux fois).
  const requested = new Map();

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) throw new ApiError(404, `Produit introuvable ou indisponible (${item.productId})`);

    const activeVariants = product.variants.filter((v) => v.isActive);
    let variant = null;
    let name = product.name;
    let available;
    let minimum;

    if (activeVariants.length > 0) {
      // Produit a variantes : le client doit choisir un poids, la quantite est un nombre de pieces entier.
      if (!item.variantId) throw new ApiError(400, `Choisissez un poids pour ${product.name}`);
      variant = activeVariants.find((v) => v.id === item.variantId);
      if (!variant) throw new ApiError(400, `Ce poids n'est plus disponible pour ${product.name}`);
      if (!Number.isInteger(item.quantity)) throw new ApiError(400, `Le nombre de pieces doit etre entier (${product.name} ${variant.label})`);
      name = `${product.name} - ${variant.label}`;
      available = variant.stockQuantity - variant.reservedQuantity;
      minimum = 1;
    } else {
      if (item.variantId) throw new ApiError(400, `Poids invalide pour ${product.name}`);
      available = product.stockQuantity - product.reservedQuantity;
      minimum = product.minOrderQuantity;
    }

    const key = `${product.id}:${variant?.id || ''}`;
    const totalRequested = (requested.get(key) || 0) + item.quantity;
    requested.set(key, totalRequested);

    if (item.quantity < minimum) {
      throw new ApiError(400, `Quantite minimum pour ${name} : ${minimum}`);
    }
    if (totalRequested > available) {
      throw new ApiError(400, `Stock insuffisant pour ${name} (disponible : ${available})`);
    }

    const unitPrice = getUnitPriceForQuantity(product, item.quantity, customer, { variant, specialPrices });
    const total = Math.round(unitPrice * item.quantity);
    subtotal += total;

    orderItemsData.push({ productId: product.id, variantId: variant?.id || null, name, unitPrice, quantity: item.quantity, total });
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

  // --- Numero de commande sequentiel (base sur le nombre de commandes du jour, a l'heure de Douala) ---
  const todaysCount = await prisma.order.count({ where: { createdAt: { gte: startOfDayDouala() } } });
  const orderNumber = generateOrderNumber(todaysCount + 1);

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber,
        customerId,
        guestName: customerId ? null : guestName,
        guestPhone: customerId ? null : guestPhone,
        addressId: address.id,
        deliveryZoneId: zone?.id || null,
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
      await adjustReserved(tx, item, item.quantity);
      await tx.stockMovement.create({
        data: { productId: item.productId, type: 'RESERVED', quantity: item.quantity, reason: `Commande ${orderNumber}${item.variantId ? ` (${item.name})` : ''}` },
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
    await adjustReserved(tx, item, -item.quantity);
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
    if (item.variantId) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stockQuantity: { decrement: item.quantity }, reservedQuantity: { decrement: item.quantity } },
      });
    } else {
      await tx.product.update({
        where: { id: item.productId },
        data: { stockQuantity: { decrement: item.quantity }, reservedQuantity: { decrement: item.quantity } },
      });
    }
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
