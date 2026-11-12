import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Chargement d'une liste de l'administration (commandes, livraisons, paiements) :
 *  - se recharge quand `params` change (comparaison par contenu, pas par identité) ;
 *  - ignore une réponse arrivée après une requête plus récente (changement d'onglet rapide) ;
 *  - garde les lignes affichées pendant le rechargement (`loading`) pour éviter les sauts de mise en page ;
 *  - `refreshMs` : actualisation silencieuse (sans clignotement ni message d'erreur) tant que l'onglet est visible.
 * Renvoie { data, loading, error, reload } ; `reload()` relance la requête et attend sa fin.
 */
export default function useAdminList(fetcher, params, { refreshMs = 0 } = {}) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const request = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const key = JSON.stringify(params);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      request.current += 1;
      const id = request.current;
      if (!silent) setState((s) => ({ ...s, loading: true, error: '' }));
      try {
        const data = await fetcherRef.current(JSON.parse(key));
        if (id === request.current) setState({ data, loading: false, error: '' });
      } catch (err) {
        if (id !== request.current || silent) return;
        setState((s) => ({ ...s, loading: false, error: err.message || 'Chargement impossible' }));
      }
    },
    [key]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!refreshMs) return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load({ silent: true });
    }, refreshMs);
    return () => clearInterval(timer);
  }, [load, refreshMs]);

  return { ...state, reload: load };
}
