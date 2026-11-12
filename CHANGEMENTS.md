# Changements (12/11/2026)

1. Navigation : barre d'icônes en bas (client : Produits, Favoris, Accueil au centre, Panier, Compte ; livreur : Livraisons, Historique, Accueil, Notifications, Profil). L'ancienne barre d'onglets déroulante du compte client est supprimée (retour « Mon compte » + menu sur la page d'accueil du compte).
2. Admin responsive : barre d'accès rapide en bas sur téléphone, menu latéral amélioré.
3. Livraison : 1 000 FCFA fixes (backend/src/config/delivery.js, variable DELIVERY_FEE ; frontend/src/config.js). Le client saisit son quartier ; les zones ne sont plus utilisées (menu Zones retiré de l'admin).
4. Prix : l'admin modifie prix, paliers dégressifs (fiche produit) et stock ; bouton « Prix » sur chaque client pour fixer un prix négocié (indépendant de la quantité).
5. Produits à poids multiples (variantes) : chaque poids a sa photo (adresse), son prix par pièce et son stock ; le client choisit le nombre de pièces par poids.

Migration à appliquer : prisma/migrations/20261112000000_variants_special_prices  (npx prisma migrate deploy puis npx prisma generate).
