import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { usePricesStore } from '../store/pricesStore';

/**
 * Charge (une fois par connexion) les prix speciaux du client connecte et les renvoie.
 * A utiliser dans le layout du site : les pages lisent ensuite `usePricesStore`.
 */
export default function useSpecialPrices() {
  const user = useAuthStore((s) => s.user);
  const load = usePricesStore((s) => s.load);
  const clear = usePricesStore((s) => s.clear);
  const loadedFor = usePricesStore((s) => s.loadedFor);

  useEffect(() => {
    if (user?.role === 'CUSTOMER' && loadedFor !== user.id) load(user.id);
    if (!user && loadedFor) clear();
  }, [user, loadedFor, load, clear]);
}
