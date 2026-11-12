import { productsApi } from '../api/catalog';
import { useCartStore, lineKey } from '../store/cartStore';
import { activeVariants, availableStock, variantAvailable } from './products';

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * « Recommander » : remet dans le panier les produits d'une ancienne commande.
 *
 * Les produits sont rechargés depuis le catalogue (prix, stock et minimum de
 * commande actuels) : on n'ajoute jamais un produit retiré du catalogue ou en
 * rupture, ni plus que le stock disponible (en tenant compte de ce qui est
 * déjà dans le panier). Le prix final reste de toute façon recalculé par le
 * serveur à la validation de la commande.
 *
 * @returns {Promise<{ added: {name: string, quantity: number, reduced: boolean}[], skipped: string[] }>}
 */
export async function reorderItems(order) {
  const lines = (order?.items || []).filter((it) => it.productId);
  const results = await Promise.allSettled(lines.map((it) => productsApi.get(it.productId)));

  const added = [];
  const skipped = [];

  results.forEach((res, idx) => {
    const line = lines[idx];
    if (res.status !== 'fulfilled' || !res.value) {
      skipped.push(line.name);
      return;
    }

    const product = res.value;
    const name = line.name || product.name;
    // Ligne d'un produit à variantes : on retrouve la variante commandée (poids) ; si elle n'existe plus, on passe.
    const variant = line.variantId ? activeVariants(product).find((v) => v.id === line.variantId) || null : null;
    if (line.variantId && !variant) {
      skipped.push(name);
      return;
    }
    const available = variant ? variantAvailable(variant) : availableStock(product);
    if (product.isActive === false || !(available > 0) || (!variant && activeVariants(product).length > 0)) {
      skipped.push(name);
      return;
    }

    const inCart = useCartStore.getState().items.find((i) => lineKey(i) === `${product.id}:${variant?.id || ''}`)?.quantity || 0;
    const minimum = variant ? 1 : Number(product.minOrderQuantity) || 1;
    const wanted = Number(line.quantity) || minimum;
    // Première fois dans le panier : au moins le minimum de commande actuel.
    let quantity = round2(inCart > 0 ? wanted : Math.max(wanted, minimum));
    const room = round2(available - inCart);
    if (quantity > room) quantity = room;

    if (quantity <= 0 || (inCart === 0 && quantity < minimum)) {
      skipped.push(name);
      return;
    }

    useCartStore.getState().addItem(product, quantity, variant);
    added.push({ name, quantity, reduced: quantity < wanted });
  });

  return { added, skipped };
}
