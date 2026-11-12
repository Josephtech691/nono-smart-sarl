# Fresh Fish — Frontend

Application React (Vite + Tailwind) pour la plateforme de vente de silures frais
et d'alevins avec livraison à Yaoundé. Couvre le site public, l'espace client,
le dashboard administrateur et l'espace livreur, conformément au cahier des
charges fourni.

## Stack

- React 18 + Vite + Tailwind CSS
- React Router (site public / compte / admin / livreur)
- Zustand (panier persistant en localStorage, session utilisateur)
- Axios + React Hook Form

## 1. Installation locale

```bash
cd frontend
npm install
cp .env.example .env
```

Renseignez `VITE_API_URL` dans `.env` (par défaut `http://localhost:4000/api`,
c'est-à-dire l'API backend lancée en local — voir `backend/README.md`).

Pour activer le bouton **« Continuer avec Google »**, renseignez aussi
`VITE_GOOGLE_CLIENT_ID` (même valeur que `GOOGLE_CLIENT_ID` côté backend ;
création de l'ID client et origines autorisées : section 7 de `backend/README.md`).
Laissé vide, le bouton est simplement masqué.

```bash
npm run dev
```

L'application est disponible sur `http://localhost:5173`.

## 2. Déploiement sur Vercel

1. Poussez ce repo sur GitHub.
2. Sur [vercel.com](https://vercel.com) : **Add New > Project**, sélectionnez le repo.
3. **Root Directory** : `frontend`
4. Vercel détecte automatiquement Vite (`npm run build`, dossier `dist`) — aucune
   configuration supplémentaire n'est nécessaire. `vercel.json` (déjà fourni)
   ajoute juste la redirection SPA nécessaire pour que l'actualisation ou
   l'accès direct à une URL comme `/produits` ou `/compte/commandes` fonctionne.
5. Ajoutez la variable d'environnement `VITE_API_URL` = URL de votre API Render,
   par exemple `https://fresh-fish-api.onrender.com/api` (et, si vous utilisez
   la connexion Google, `VITE_GOOGLE_CLIENT_ID`).
6. Déployez. Une fois l'URL Vercel connue (ex : `https://fresh-fish-sarl.vercel.app`,
   **sans slash final**), reportez-la **exactement** dans la variable `FRONTEND_URL`
   du backend sur Render, puis redéployez le backend — sinon les requêtes seront
   bloquées par CORS (voir `backend/README.md` section dépannage).

## 3. Comptes de démonstration

Une fois le backend seedé (`npm run seed` côté backend), vous pouvez tester :

| Espace | URL | Téléphone | Mot de passe |
|---|---|---|---|
| Client | `/connexion` | 690000000 | password123 |
| Administration | `/admin/connexion` | 659103000 | password123 |
| Livreur | `/livreur/connexion` | 674331099 | password123 |

## 4. Identité visuelle

Les couleurs, la typographie (Sora / Inter) et le ton général reprennent la
maquette fournie (vert forêt, blanc, badges arrondis). Le logo (`public/brand/`),
le favicon, les icônes PWA (`public/icons/`) et les photos produits
(`public/products/`) sont **vos propres visuels** — logo et photos que vous
avez fournis, pas des illustrations générées. Le composant `ProductDetail`
affiche une petite galerie si un produit a plusieurs photos (voir
`prisma/seed.js` pour l'exemple avec 3 photos par produit). Si vous n'avez
pas les droits de réutilisation sur certaines de ces images (par exemple si
elles viennent d'ailleurs que votre propre exploitation), pensez à les
remplacer par vos propres prises de vue avant une mise en ligne commerciale —
ça reste ajustable à tout moment depuis **Admin > Produits > Images**.

## 5. Fonctionnalités Phase 2 / Phase 3 (toutes implémentées côté frontend)

- **Carte interactive** (Leaflet + tuiles OpenStreetMap, sans clé API) : sélection d'adresse au checkout, suivi du livreur en direct sur la commande
- **Suivi livreur en temps réel** : la position s'affiche automatiquement pendant la livraison (rafraîchie toutes les 10s côté client, envoyée toutes les 20s côté livreur via `navigator.geolocation.watchPosition`)
- **Factures PDF** téléchargeables depuis la confirmation, le suivi et le dashboard admin
- **Commandes programmées** (date/heure au checkout) et **commandes récurrentes** (page dédiée `Compte > Commandes récurrentes`)
- **Comptes professionnels / tarifs grossistes** (`Compte > Compte pro`, approbation admin dans `Admin > Clients`)
- **Programme de parrainage** (`Compte > Parrainage`) — bonus suggéré et implémenté
- **Statistiques avancées** (`Admin > Statistiques avancées`) : marges par produit, meilleurs clients, performance des livreurs, prévision de rupture de stock, détection d'anomalies — avec graphiques
- **Attribution automatique du livreur** (bouton "Auto-assigner" sur une commande prête, en plus de l'assignation manuelle)
- **Recommandations produits** affichées sur chaque fiche produit ("Les clients ont aussi acheté", basé sur la co-occurrence dans les commandes)
- **PWA** : le site est installable (`manifest.json` + service worker basique dans `public/`), avec icônes dédiées

## 6. Back-office (`/admin`)

| Page | Ce qu'on y fait |
|---|---|
| **Tableau de bord** | Commandes du jour, chiffre d'affaires du mois, livraisons en cours, clients, courbe des ventes avec choix de la période, et les « À faire » (commandes en attente, Mobile Money à vérifier, produits en stock faible, livreurs disponibles) ; chaque carte ouvre la liste correspondante |
| **Commandes** | Onglets par état avec compteurs, recherche (n°, nom, téléphone, quartier), filtres moyen/état de paiement, zone et dates, export CSV, pagination ; les filtres restent dans l'adresse de la page (partageable) |
| **Fiche commande** | Changer le statut, assigner / changer / auto-assigner le livreur, relancer une livraison signalée « non livrée », annuler (avec motif), marquer payé / remboursé, facture PDF (télécharger ou imprimer), historique, appel et WhatsApp client |
| **Livraisons** | Qui livre quoi : onglets « À assigner », « Assignées », « En cours », « Livrées », « Problèmes », filtre par livreur, montant à encaisser en espèces |
| **Paiements** | Synthèse (encaissé, en attente, à rembourser, remboursé), onglets, « Marquer payé » (Mobile Money confirmé à la main ou espèces encaissées) et « Marquer remboursé » |
| **Livreurs** | Disponibilité modifiable en un clic, charge de travail, ajout d'un livreur (identifiants à transmettre par WhatsApp), mot de passe provisoire, désactivation / réactivation du compte |
| **Clients** | Recherche, demandes de compte professionnel (approuver avec une remise de 0 à 50 % ou refuser), mot de passe provisoire (WhatsApp), comptes Google sans téléphone signalés |
| **Produits** | Recherche, filtres catégorie / stock bas / inactifs, pagination, **ajustement du stock** (entrée/sortie ou inventaire, motif tracé), formulaire complet (prix dégressifs, coût d'achat, images), désactivation / réactivation |
| Catégories, Zones, Avis, Promotions, Statistiques, Finances | Comme décrit dans les sections précédentes |

La **cloche de notifications** (site client, administration et espace livreur)
affiche le nombre de notifications non lues, se met à jour toute seule toutes les
45 secondes et prévient par une bulle quand une nouvelle arrive (par exemple une
nouvelle commande ou une demande de compte professionnel).

## 7. Ce qui reste hors périmètre (au-delà des Phases 2/3 demandées)

Applications natives Android/iOS, multi-villes/multi-entreprises/marketplace, chatbot — voir `backend/README.md` pour le détail.


## Trois applications (clients, livreurs, admin)

Le même code produit trois applications distinctes (`src/routes/*`, `src/apps/*`, `src/entries/*`) :

```bash
npm run dev:client   # http://localhost:5173  (clients)
npm run dev:admin    # http://localhost:5174  (administration)
npm run dev:driver   # http://localhost:5175  (livreurs)
npm run build:apps   # dist/client, dist/admin, dist/driver
```

Chaque application a sa page HTML, son manifeste PWA et ne contient que ses propres pages. `npm run dev` / `npm run build` produisent encore le site complet. Sur Vercel : un projet par application avec *Output Directory* `dist/<app>`.
