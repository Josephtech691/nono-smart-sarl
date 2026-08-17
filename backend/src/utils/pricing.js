// Calcule le prix unitaire applicable pour une quantite donnee, en tenant
// compte des paliers degressifs (section 8 / 27 / 28 du cahier des charges)
// PUIS de la remise grossiste eventuelle d'un client professionnel approuve
// (section 47 / 75 "tarifs grossistes"). product doit inclure sa relation
// priceTiers, triee par minQuantity ASC.
function getUnitPriceForQuantity(product, quantity, customer = null) {
  let price = product.price;
  if (product.priceTiers?.length) {
    const sortedTiers = [...product.priceTiers].sort((a, b) => a.minQuantity - b.minQuantity);
    for (const tier of sortedTiers) {
      if (quantity >= tier.minQuantity) price = tier.unitPrice;
    }
  }
  if (
    customer &&
    customer.customerType === 'PROFESSIONNEL' &&
    customer.professionalStatus === 'APPROVED' &&
    customer.wholesaleDiscountPercent > 0
  ) {
    price = Math.round(price * (1 - customer.wholesaleDiscountPercent / 100));
  }
  return price;
}

function computeCouponDiscount(coupon, subtotal) {
  if (!coupon) return 0;
  const raw = coupon.type === 'PERCENTAGE' ? Math.round((subtotal * coupon.value) / 100) : coupon.value;
  return Math.max(0, Math.min(raw, subtotal));
}

module.exports = { getUnitPriceForQuantity, computeCouponDiscount };
