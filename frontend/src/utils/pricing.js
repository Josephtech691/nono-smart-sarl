// Miroir cote client de backend/src/utils/pricing.js : utilise uniquement pour
// l'affichage en temps reel (panier, fiche produit). Le prix final est
// toujours recalcule et verifie cote serveur a la creation de la commande.
//
// Ordre de priorite :
//  1. prix special fixe par l'administration pour ce client (produit ou variante) : tel quel, quelle que soit la quantite ;
//  2. prix de la variante choisie (par piece) ou prix de base du produit + paliers degressifs ;
//  3. remise grossiste d'un client professionnel approuve (jamais cumulee avec un prix special).

/** Prix special du client pour ce produit (et cette variante), ou null. */
export function findSpecialPrice(specialPrices, productId, variantId = null) {
  if (!specialPrices?.length) return null;
  const hit = specialPrices.find((p) => p.productId === productId && (p.variantId || null) === (variantId || null));
  return hit ? hit.unitPrice : null;
}

/**
 * `product` : un produit du catalogue ({ id, price, priceTiers }) ou une ligne du panier
 * ({ productId, variantId, price, priceTiers }). Pour une ligne de variante, `price` est le prix de la variante.
 */
export function getUnitPriceForQuantity(product, quantity, customer = null, specialPrices = null) {
  const productId = product?.productId ?? product?.id;
  const special = findSpecialPrice(specialPrices, productId, product?.variantId);
  if (special != null) return special;

  let price = product?.price ?? 0;
  if (!product?.variantId && product?.priceTiers?.length) {
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

// Lignes du tableau "Quantite / Prix" de la fiche produit.
// maxQuantity = derniere quantite achetable avant le palier suivant (null = "et +").
export function getTierRows(product) {
  const tiers = [...(product?.priceTiers || [])].sort((a, b) => a.minQuantity - b.minQuantity);
  const isWeight = product?.unit === 'KILOGRAM' || product?.unit === 'GRAM';
  const step = isWeight ? 0.5 : 1;
  return tiers.map((tier, i) => {
    const next = tiers[i + 1];
    return {
      minQuantity: tier.minQuantity,
      maxQuantity: next ? Number((next.minQuantity - step).toFixed(2)) : null,
      unitPrice: tier.unitPrice,
    };
  });
}

export function nextTierHint(product, quantity) {
  if (product?.variantId || !product?.priceTiers?.length) return null;
  const sorted = [...product.priceTiers].sort((a, b) => a.minQuantity - b.minQuantity);
  const next = sorted.find((t) => t.minQuantity > quantity);
  return next || null;
}
