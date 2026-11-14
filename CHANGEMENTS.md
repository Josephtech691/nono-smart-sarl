# Changements (12/11/2026)

1. Navigation : barre d'icônes en bas (client : Produits, Favoris, Accueil au centre, Panier, Compte ; livreur : Livraisons, Historique, Accueil, Notifications, Profil). L'ancienne barre d'onglets déroulante du compte client est supprimée (retour « Mon compte » + menu sur la page d'accueil du compte).
2. Admin responsive : barre d'accès rapide en bas sur téléphone, menu latéral amélioré.
3. Livraison : 1 000 FCFA fixes (backend/src/config/delivery.js, variable DELIVERY_FEE ; frontend/src/config.js). Le client saisit son quartier ; les zones ne sont plus utilisées (menu Zones retiré de l'admin).
4. Prix : l'admin modifie prix, paliers dégressifs (fiche produit) et stock ; bouton « Prix » sur chaque client pour fixer un prix négocié (indépendant de la quantité).
5. Produits à poids multiples (variantes) : chaque poids a sa photo (adresse), son prix par pièce et son stock ; le client choisit le nombre de pièces par poids.

Migration à appliquer : prisma/migrations/20261112000000_variants_special_prices  (npx prisma migrate deploy puis npx prisma generate).

# Application Android clients (14/11/2026)
Voir native-client/README.md (Capacitor + GitHub Actions + notifications push Firebase).
Backend : table device_tokens (migration 20261114000000_device_tokens), routes POST/DELETE /api/devices, envoi FCM dans utils/notify.js, variable FIREBASE_SERVICE_ACCOUNT.
Frontend : bouton Google masqué dans l'application, pas de service worker dans l'application, déconnexion automatique sur session expirée.

# Mises à jour du 14/11/2026 (2)
- Clients : bouton « Commander » (achat direct sans panier) + petite icône panier sur chaque produit et sur la fiche produit ; accueil compact avec photo en arrière-plan, produits juste après ; choix de l'emplacement sur la carte (repère déplaçable) en plus du GPS.
- Compte : suppression par le client (profil + page /suppression-compte) ; l'admin peut activer / désactiver un compte client.
- Admin : bouton « Valider comme livrée » (motif obligatoire, cas exceptionnel) ; correction du débordement horizontal des pages (grilles).
