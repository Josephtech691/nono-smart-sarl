import { Link, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

/**
 * Remplace l'ancienne barre d'onglets déroulante de l'espace client : sur une page du compte,
 * un simple retour vers « Mon compte » (le menu complet est la page d'accueil du compte, et
 * la navigation principale est la barre d'icônes en bas de l'écran).
 */
export default function AccountBack() {
  const { pathname } = useLocation();
  // Sur la page d'accueil du compte il n'y a rien à retrouver : on n'affiche rien.
  if (pathname === '/compte') return null;
  // Une fiche de commande revient à la liste des commandes.
  const inOrder = /^\/compte\/commandes\/[^/]+/.test(pathname);
  return (
    <Link
      to={inOrder ? '/compte/commandes' : '/compte'}
      className="mb-5 mt-2 inline-flex items-center gap-1 rounded-full py-1.5 pr-3 text-sm font-semibold text-brand-700 hover:underline"
    >
      <ChevronLeft size={18} aria-hidden="true" /> {inOrder ? 'Mes commandes' : 'Mon compte'}
    </Link>
  );
}
