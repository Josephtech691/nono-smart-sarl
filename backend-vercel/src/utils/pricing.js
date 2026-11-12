// Calcule le prix unitaire applicable a une ligne de commande.
//
// Ordre de priorite :
//  1. PRIX SPECIAL du client (fixe par l'administration pour ce client + ce produit / cette variante) :
//     il s'applique tel quel, quelle que soit la quantite (ni paliers, ni remise grossiste).
//  2. Variante choisie : prix de la variante (par piece).
//  3. Produit simple : prix de base, puis paliers degressifs selon la quantite.
//  4. Remise grossiste eventuelle d'un client professionnel approuve (sauf si prix special).
//
// product doit inclure sa relation priceTiers ; variant (facultatif) est la variante choisie ;
// specialPrices est la liste des prix speciaux du client [{ productId, variantId, unitPrice }].
function findSpecialPrice(specialPrices, productId, variantId = null) {
  if (!specialPrices?.length) return null;
  const hit = specialPrices.find((p) => p.productId === productId && (p.variantId || null) === (variantId || null));
  return hit ? hit.unitPrice : null;
}

function getUnitPriceForQuantity(product, quantity, customer = null, { variant = null, specialPrices = null } = {}) {
  const special = findSpecialPrice(specialPrices, product.id, variant?.id);
  if (special != null) return special;

  let price = variant ? variant.price : product.price;
  if (!variant && product.priceTiers?.length) {
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

module.exports = { getUnitPriceForQuantity, computeCouponDiscount, findSpecialPrice };
