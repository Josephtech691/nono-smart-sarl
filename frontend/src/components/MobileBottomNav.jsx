import { useLocation } from 'react-router-dom';
import { LayoutGrid, Heart, Home, ShoppingCart, User } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { accountHomePath } from '../utils/account';
import IconTabBar from './IconTabBar';

/**
 * La barre est masquée pendant la commande : l'écran est déjà chargé
 * (étapes, récapitulatif, bouton de validation) et elle gênerait la saisie.
 */
export function showsBottomNav(pathname) {
  return pathname !== '/checkout';
}

const ACCOUNT_AREA = /^\/(compte|suivi-commande|commande-confirmee|connexion|inscription|mot-de-passe-oublie)(\/|$)/;

/** Barre de navigation d'icônes fixe en bas de l'écran sur mobile (façon application). */
export default function MobileBottomNav() {
  const { pathname } = useLocation();
  const user = useAuthStore((s) => s.user);
  const cartCount = useCartStore((s) => s.items.length);

  const inFavorites = pathname.startsWith('/compte/favoris');
  const inAccountArea = ACCOUNT_AREA.test(pathname) && !inFavorites;

  const items = [
    { key: 'shop', to: '/produits', label: 'Produits', icon: LayoutGrid, active: pathname.startsWith('/produits') },
    { key: 'favorites', to: user?.role === 'CUSTOMER' ? '/compte/favoris' : '/connexion', label: 'Favoris', icon: Heart, active: inFavorites },
    { key: 'home', to: '/', label: 'Accueil', icon: Home, active: pathname === '/' },
    { key: 'cart', to: '/panier', label: 'Panier', icon: ShoppingCart, active: pathname === '/panier', badge: cartCount },
    { key: 'account', to: accountHomePath(user), label: user ? 'Mon compte' : 'Connexion', icon: User, active: inAccountArea },
  ];

  return <IconTabBar items={items} label="Navigation principale mobile" className="lg:hidden" />;
}
