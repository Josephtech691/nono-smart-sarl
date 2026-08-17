// Miroir cote client de backend/src/utils/pricing.js : utilise uniquement pour
// l'affichage en temps reel (panier, fiche produit). Le prix final est
// toujours recalcule et verifie cote serveur a la creation de la commande.
export function getUnitPriceForQuantity(product, quantity, customer = null) {
  let price = product?.price ?? 0;
  if (product?.priceTiers?.length) {
    const sorted = [...product.priceTiers].sort((a, b) => a.minQuantity - b.minQuantity);
    for (const tier of sorted) {
      if (quantity >= tier.minQuantity) price = tier.unitPrice;
    }
  }
  if (
    customer?.customerType === 'PROFESSIONNEL' &&
    customer?.professionalStatus === 'APPROVED' &&
    customer?.wholesaleDiscountPercent > 0
  ) {
    price = Math.round(price * (1 - customer.wholesaleDiscountPercent / 100));
  }
  return price;
}

export function nextTierHint(product, quantity) {
  if (!product?.priceTiers?.length) return null;
  const sorted = [...product.priceTiers].sort((a, b) => a.minQuantity - b.minQuantity);
  const next = sorted.find((t) => t.minQuantity > quantity);
  return next || null;
}
