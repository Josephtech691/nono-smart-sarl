import { create } from 'zustand';
import { customersApi } from '../api/customers';

// Prix speciaux du client connecte (fixes par l'administration). Charges une fois a la connexion ;
// le serveur recalcule de toute facon le prix a la commande.
export const usePricesStore = create((set) => ({
  prices: [],
  loadedFor: null,

  load: async (userId) => {
    try {
      const prices = await customersApi.myPrices();
      set({ prices, loadedFor: userId });
    } catch (e) {
      set({ prices: [], loadedFor: userId });
    }
  },

  clear: () => set({ prices: [], loadedFor: null }),
}));
