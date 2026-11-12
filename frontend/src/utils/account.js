/**
 * Page d'accueil de l'espace de l'utilisateur connecté : chaque rôle a son propre espace.
 * (Un client n'a pas accès à /admin, un livreur n'a pas accès à /compte, etc.)
 */
export function accountHomePath(user) {
  if (!user) return '/connexion';
  if (user.role === 'ADMIN') return '/admin';
  if (user.role === 'DRIVER') return '/livreur';
  return '/compte';
}

/** Page « mes commandes » : l'historique pour un client, le suivi par numéro pour les autres. */
export function ordersPath(user) {
  return user?.role === 'CUSTOMER' ? '/compte/commandes' : '/suivi-commande';
}
