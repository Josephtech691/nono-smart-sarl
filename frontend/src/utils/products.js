// Règles de stock partagées par la page Produits de l'administration (mêmes règles que le serveur :
// l'alerte du tableau de bord compte exactement les produits de l'onglet « Stock bas »).

const round2 = (n) => Math.round(n * 100) / 100;

/** Un produit à variantes (200 g, 300 g…) : chaque variante a son propre stock, en pièces. */
export const hasVariants = (product) => Array.isArray(product?.variants) && product.variants.some((v) => v.isActive !== false);
export const activeVariants = (product) => (product?.variants || []).filter((v) => v.isActive !== false);

/** Pièces vendables d'une variante : stock physique moins ce qui est réservé. */
export const variantAvailable = (variant) => Math.max(0, round2((Number(variant?.stockQuantity) || 0) - (Number(variant?.reservedQuantity) || 0)));

/**
 * Quantité réellement vendable : stock physique moins ce qui est réservé par des commandes en cours.
 * Pour un produit à variantes : total des pièces disponibles de toutes ses variantes actives.
 */
export const availableStock = (product) => {
  if (hasVariants(product)) return activeVariants(product).reduce((sum, v) => sum + variantAvailable(v), 0);
  return round2((Number(product.stockQuantity) || 0) - (Number(product.reservedQuantity) || 0));
};

/** Produit actif dont le stock disponible est descendu au seuil d'alerte (seuil à 0 = pas d'alerte). */
export const isLowStock = (product) => Boolean(product.isActive) && Number(product.alertThreshold) > 0 && availableStock(product) <= Number(product.alertThreshold);

/** Plus rien à vendre (quel que soit le seuil d'alerte). */
export const isOutOfStock = (product) => availableStock(product) <= 0;

export { round2 };
