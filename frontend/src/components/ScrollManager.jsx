import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Gère le défilement lors des changements de page (React Router ne le fait pas) :
 *  - nouvelle page  -> retour en haut ;
 *  - lien d'ancre (/#comment-ca-marche) -> défilement jusqu'à l'élément ;
 *  - retour arrière du navigateur -> on laisse le navigateur restaurer la position ;
 *  - simple changement de filtre dans l'adresse (?filtre=...) -> aucun défilement.
 */
export default function ScrollManager() {
  const { pathname, hash, key } = useLocation();
  const navigationType = useNavigationType();
  // Cliquer deux fois sur le même lien d'ancre doit refaire défiler.
  const anchorKey = hash ? key : '';

  useEffect(() => {
    if (hash) {
      const id = decodeURIComponent(hash.slice(1));
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      // Court délai : la page cible vient de s'afficher.
      const timer = setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      }, 80);
      return () => clearTimeout(timer);
    }
    if (navigationType !== 'POP') window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    return undefined;
    // navigationType est volontairement absent des dépendances : un remplacement d'adresse
    // sur la même page (changement de filtre) ne doit pas remonter la page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, hash, anchorKey]);

  return null;
}
