import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getUnitPriceForQuantity } from '../utils/pricing';

// Panier gere cote client (localStorage) : fonctionne aussi bien pour un
// invite que pour un client connecte, sans aller-retour serveur a chaque
// changement de quantite. Voir backend/README.md pour la justification de ce
// choix (les modeles Cart/CartItem existent en base pour une V2 synchronisee).
export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [], // { productId, name, slug, image, unit, price, priceTiers, quantity, minOrderQuantity, stockAvailable }

      addItem: (product, quantity) => {
        const items = [...get().items];
        const idx = items.findIndex((i) => i.productId === product.id);
        if (idx >= 0) {
          items[idx] = { ...items[idx], quantity: items[idx].quantity + quantity };
        } else {
          items.push({
            productId: product.id,
            name: product.name,
            slug: product.slug,
            image: product.images?.[0]?.url || null,
            unit: product.unit,
            price: product.price,
            priceTiers: product.priceTiers || [],
            minOrderQuantity: product.minOrderQuantity || 1,
            stockAvailable: product.stockQuantity - product.reservedQuantity,
            quantity,
          });
        }
        set({ items });
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) return get().removeItem(productId);
        set({ items: get().items.map((i) => (i.productId === productId ? { ...i, quantity } : i)) });
      },

      removeItem: (productId) => set({ items: get().items.filter((i) => i.productId !== productId) }),

      clear: () => set({ items: [] }),

      count: () => get().items.reduce((sum, i) => sum + 1, 0),

      subtotal: (customer = null) =>
        get().items.reduce((sum, i) => sum + Math.round(getUnitPriceForQuantity(i, i.quantity, customer) * i.quantity), 0),
    }),
    { name: 'nono_smart_cart' }
  )
);
