import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Filtres d'une liste conservés dans l'adresse de la page (?groupe=pending&page=2) : le bouton « retour »,
 * un rechargement ou un lien venu du tableau de bord ou d'une notification retrouvent la même vue.
 *
 * `defaults` (objet défini hors du composant) liste les filtres connus et leur valeur par défaut ; une
 * valeur par défaut ou vide n'apparaît pas dans l'adresse. Renvoie [filtres, mettreÀJour(patch)] ;
 * pour changer d'onglet, de recherche ou de dates, passer aussi `page: 1`.
 */
export default function useUrlFilters(defaults) {
  const [params, setParams] = useSearchParams();

  const filters = useMemo(() => {
    const out = {};
    Object.keys(defaults).forEach((key) => {
      out[key] = params.get(key) ?? defaults[key];
    });
    return out;
  }, [params, defaults]);

  const update = useCallback(
    (patch) => {
      const next = new URLSearchParams(params);
      Object.entries(patch).forEach(([key, value]) => {
        const text = value === undefined || value === null ? '' : String(value);
        if (text === '' || text === String(defaults[key])) next.delete(key);
        else next.set(key, text);
      });
      setParams(next, { replace: true });
    },
    [params, setParams, defaults]
  );

  return [filters, update];
}
