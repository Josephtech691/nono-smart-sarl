import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getUnitPriceForQuantity } from '../utils/pricing';

// Une ligne du panier = un produit, ou un produit + une variante (poids) : le meme produit peut donc apparaitre
// plusieurs fois (silure 300 g, silure 500 g...), chaque ligne avec sa propre quantite.
export const lineKey = (item) => `${item.productId}:${item.variantId || ''}`;

// Construit une ligne de panier / d'achat direct à partir d'un produit (et d'une variante éventuelle).
export function buildLine(product, quantity, variant = null) {
  const stockAvailable = variant
    ? Math.max(0, (variant.stockQuantity || 0) - (variant.reservedQuantity || 0))
    : product.stockQuantity - product.reservedQuantity;
  return {
    productId: product.id,
    variantId: variant?.id || null,
    variantLabel: variant?.label || null,
    name: product.name,
    slug: product.slug,
    image: variant?.imageUrl || product.images?.[0]?.url || null,
    unit: variant ? 'PIECE' : product.unit,
    price: variant ? variant.price : product.price,
    priceTiers: variant ? [] : product.priceTiers || [],
    minOrderQuantity: variant ? 1 : product.minOrderQuantity || 1,
    stockAvailable,
    quantity,
  };
}

/** Sous-total d'une liste de lignes (panier ou achat direct), avec prix négociés et remise grossiste. */
export const subtotalOf = (items, customer = null, specialPrices = null) =>
  items.reduce((sum, i) => sum + Math.round(getUnitPriceForQuantity(i, i.quantity, customer, specialPrices) * i.quantity), 0);

// Panier gere cote client (localStorage) : fonctionne aussi bien pour un
// invite que pour un client connecte, sans aller-retour serveur a chaque
// changement de quantite. Voir backend/README.md pour la justification de ce
// choix (les modeles Cart/CartItem existent en base pour une V2 synchronisee).
export const useCartStore = create(
  persist(
    (set, get) => ({
      // { productId, variantId?, variantLabel?, name, slug, image, unit, price, priceTiers, quantity, minOrderQuantity, stockAvailable }
      items: [],

      // Achat direct (bouton « Commander ») : une seule ligne, hors panier, jamais conservée (ni dans le panier ni après rechargement).
      direct: null,
      startDirect: (product, quantity, variant = null) => set({ direct: [buildLine(product, quantity, variant)] }),
      startDirectMany: (lines) => set({ direct: lines }),
      clearDirect: () => set({ direct: null }),

      // `variant` : variante choisie (poids) ; sa quantite est un nombre de pieces. Prix = prix de la variante.
      addItem: (product, quantity, variant = null) => {
        const items = [...get().items];
        const probe = { productId: product.id, variantId: variant?.id || null };
        const idx = items.findIndex((i) => lineKey(i) === lineKey(probe));
        const stockAvailable = variant
          ? Math.max(0, (variant.stockQuantity || 0) - (variant.reservedQuantity || 0))
          : product.stockQuantity - product.reservedQuantity;

        if (idx >= 0) {
          items[idx] = { ...items[idx], quantity: items[idx].quantity + quantity, stockAvailable };
        } else {
          items.push({
            productId: product.id,
            variantId: variant?.id || null,
            variantLabel: variant?.label || null,
            name: product.name,
            slug: product.slug,
            image: variant?.imageUrl || product.images?.[0]?.url || null,
            unit: variant ? 'PIECE' : product.unit,
            price: variant ? variant.price : product.price,
            priceTiers: variant ? [] : product.priceTiers || [],
            minOrderQuantity: variant ? 1 : product.minOrderQuantity || 1,
            stockAvailable,
            quantity,
          });
        }
        set({ items });
      },

      updateQuantity: (key, quantity) => {
        if (quantity <= 0) return get().removeItem(key);
        set({ items: get().items.map((i) => (lineKey(i) === key ? { ...i, quantity } : i)) });
      },

      removeItem: (key) => set({ items: get().items.filter((i) => lineKey(i) !== key) }),

      clear: () => set({ items: [] }),

      count: () => get().items.length,

      // specialPrices : prix speciaux du client connecte (voir pricesStore)
      subtotal: (customer = null, specialPrices = null) =>
        get().items.reduce((sum, i) => sum + Math.round(getUnitPriceForQuantity(i, i.quantity, customer, specialPrices) * i.quantity), 0),
    }),
    { name: 'fresh_fish_cart', partialize: (state) => ({ items: state.items }) }
  )
);

/** Lignes du panier au format attendu par l'API (commande, commande recurrente). */
export const orderLines = (items) => items.map((i) => ({ productId: i.productId, variantId: i.variantId || undefined, quantity: i.quantity }));
