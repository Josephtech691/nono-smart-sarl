import { create } from 'zustand';
import { driversApi } from '../api/logistics';
import { toast } from './toastStore';
import { deliveryGroup } from '../utils/delivery';

/**
 * Données de l'espace livreur partagées entre les écrans (accueil, liste, barre du bas) :
 * synthèse chiffrée + livraisons à faire / en cours. Rafraîchies automatiquement par
 * DriverLayout ; `announce` signale au livreur une livraison qui vient de lui être assignée.
 */
export const useDriverStore = create((set, get) => ({
  summary: null,
  active: null, // null = pas encore chargé
  error: false,
  // Partage de la position GPS : idle | waiting | sharing | denied | unsupported
  gps: 'idle',

  refresh: async ({ announce = false } = {}) => {
    try {
      const [summary, active] = await Promise.all([driversApi.mySummary(), driversApi.myDeliveries({ scope: 'active' })]);
      const previous = get().active;
      if (announce && previous) {
        const known = new Set(previous.map((d) => d.id));
        const fresh = active.filter((d) => !known.has(d.id) && deliveryGroup(d) === 'todo');
        if (fresh.length) {
          toast.info(fresh.length === 1 ? `Nouvelle livraison : ${fresh[0].order.orderNumber}` : `${fresh.length} nouvelles livraisons assignées`);
          if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(200);
        }
      }
      set({ summary, active, error: false });
    } catch (err) {
      // On garde les dernières données connues : un trou de réseau ne doit pas vider l'écran.
      set({ error: true, active: get().active || [] });
    }
  },

  setStatus: (status) => set((s) => ({ summary: s.summary ? { ...s.summary, status } : s.summary })),

  // Ne notifie personne quand la valeur ne change pas (le GPS rappelle très souvent).
  setGps: (gps) => set((s) => (s.gps === gps ? s : { gps })),

  reset: () => set({ summary: null, active: null, error: false, gps: 'idle' }),
}));
