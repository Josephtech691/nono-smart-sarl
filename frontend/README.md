# NONO SMART SARL — Frontend

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

```bash
npm run dev
```

L'application est disponible sur `http://localhost:5173`.

## 2. Déploiement sur Vercel

1. Poussez ce repo sur GitHub.
2. Sur [vercel.com](https://vercel.com) : **Add New > Project**, sélectionnez le repo.
3. **Root Directory** : `frontend`
4. Vercel détecte automatiquement Vite (`npm run build`, dossier `dist`) — aucune
   configuration supplémentaire n'est nécessaire.
5. Ajoutez la variable d'environnement `VITE_API_URL` = URL de votre API Render,
   par exemple `https://nono-smart-api.onrender.com/api`.
6. Déployez. Une fois l'URL Vercel connue, reportez-la dans la variable
   `FRONTEND_URL` du backend sur Render (sinon les requêtes seront bloquées par
   CORS).

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

## 6. Ce qui reste hors périmètre (au-delà des Phases 2/3 demandées)

Applications natives Android/iOS, multi-villes/multi-entreprises/marketplace, chatbot — voir `backend/README.md` pour le détail.
