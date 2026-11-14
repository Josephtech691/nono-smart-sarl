# Fresh Fish — API backend

API REST pour la plateforme de vente de silures frais et d'alevins avec livraison
à Yaoundé. Node.js + Express + Prisma + PostgreSQL, conforme au cahier des
charges fourni (architecture, statuts de commande, rôles, sécurité).

## Stack

- Node.js 18+ / Express 4
- PostgreSQL + Prisma ORM
- JWT (Bearer token) pour l'authentification, rôles `CUSTOMER` / `ADMIN` / `DRIVER`
- Zod pour la validation des entrées, Helmet + CORS + rate limiting pour la sécurité

## 1. Installation locale

```bash
cd backend
npm install
cp .env.example .env
```

Démarrez une base Postgres locale (ou pointez `DATABASE_URL` vers une base existante) :

```bash
docker compose up -d
```

Puis créez le schéma et les données de démonstration :

```bash
npx prisma migrate dev --name init
npm run seed
```

Lancez l'API :

```bash
npm run dev
```

L'API écoute sur `http://localhost:4000`. Vérifiez avec `GET /api/health`.

### Comptes de démonstration (créés par `npm run seed`, mot de passe `password123`)

| Rôle    | Téléphone   | Email                    |
|---------|-------------|--------------------------|
| Admin   | 659103000   | admin@freshfish.cm       |
| Livreur | 674331099   | jean.livreur@freshfish.cm|
| Client  | 690000000   | client@demo.cm           |

**À changer immédiatement en production** — ce sont des identifiants de démonstration.

## 2. Déploiement sur Render

> ℹ️ **Migrations fournies.** Le dossier `prisma/migrations/` contient déjà la
> migration initiale (`20260810120000_init`) et celle de la connexion Google
> (`20260827000000_google_oauth`). `npx prisma migrate deploy`, lancé au build
> par Render, les applique : la base est créée toute seule au premier
> déploiement. Il ne reste qu'à la remplir une fois (`npm run seed`, voir
> l'étape 3).

Deux options pour déployer :

### Option A — Blueprint (`render.yaml`, recommandé)

1. Poussez ce repo sur GitHub.
2. Dans le dashboard Render : **New > Blueprint**, sélectionnez le repo. Render lit
   `backend/render.yaml` et crée automatiquement le service web et la base Postgres.
3. Render vous demandera de renseigner les variables marquées `sync: false`
   (`FRONTEND_URL`, clés MTN/Orange) — `FRONTEND_URL` doit être l'URL Vercel du frontend
   **exacte**, sans slash final (ex : `https://fresh-fish-sarl.vercel.app`).
4. `JWT_SECRET` est généré automatiquement par Render.

### Option B — Manuelle

1. **New > PostgreSQL** sur Render → notez la `Internal Connection String`.
2. **New > Web Service** → connectez le repo, `Root Directory` = `backend`.
3. Build command : `npm install && npx prisma migrate deploy`
4. Start command : `npm start`
5. Ajoutez les variables d'environnement de `.env.example` (au minimum
   `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`, `FRONTEND_URL`).

### 3. Remplir la base (une seule fois)

Après le premier déploiement réussi, ouvrez le **Shell** du service
(dashboard Render > votre service > onglet **Shell**) et lancez :

```bash
npm run seed            # catégories, produits, zones, comptes de démonstration
```

Ou, depuis votre ordinateur, avec l'URL **externe** de la base (dashboard >
votre base Postgres > Connections > « External Database URL ») dans `.env` :

```bash
npm install
npx prisma migrate deploy
npm run seed
```

- `npm run seed` **repart de zéro** (efface puis recrée les données de
  démonstration) : à ne lancer que sur une base neuve.
- `npm run seed:catalog` **n'efface rien** : il ajoute seulement les variantes
  de silure qui manquent (entier, nettoyé, découpé, gros, moyen, fumé) et
  ignore celles qui existent déjà. On peut le relancer sans risque, même sur
  une base de production déjà remplie.
- Quand vous modifiez `prisma/schema.prisma`, générez une nouvelle migration
  avec `npx prisma migrate dev --name <description>` et committez le dossier
  `prisma/migrations/` : le déploiement suivant l'appliquera automatiquement.

> ⚠️ **Base Postgres gratuite Render** : elle expire automatiquement 30 jours après
> sa création (14 jours de grâce ensuite avant suppression définitive). Pratique
> pour développer et présenter le projet, mais il faudra passer sur un plan payant
> avant l'expiration pour un usage réel. Le service web gratuit se met aussi en
> veille après 15 minutes d'inactivité (le premier appel après une veille prend
> ~1 minute). Vérifiez les tarifs actuels sur render.com avant de choisir un plan.

## 3. Dépannage : erreur CORS depuis le frontend

Si le navigateur affiche `blocked by CORS policy: No 'Access-Control-Allow-Origin' header`,
c'est presque toujours que `FRONTEND_URL` (variable d'environnement Render)
ne correspond pas exactement à l'origine du frontend :

1. Dashboard Render > votre service > **Environment** > vérifiez `FRONTEND_URL`.
2. Elle doit être **identique** à l'URL affichée dans l'erreur du navigateur
   (ex : `https://fresh-fish-sarl.vercel.app`), sans slash final. Un slash
   final ou un `www.` en trop suffit à faire échouer la comparaison.
3. Plusieurs origines (ex: domaine personnalisé + sous-domaine Vercel) :
   séparez-les par une virgule, sans espace : `FRONTEND_URL=https://a.com,https://b.vercel.app`
4. Sauvegardez → Render redéploie automatiquement. Attendez la fin du déploiement
   (onglet **Logs**) avant de retester.
5. Toute origine refusée est maintenant journalisée côté serveur
   (`[cors] Origine refusee : "..."`), visible dans les Logs Render — utile
   pour confirmer l'origine exacte envoyée par le navigateur si le problème persiste.

## 4. Ce qui est implémenté (MVP + Phase 2 + Phase 3 complètes)

En reprenant les phases définies dans le cahier des charges (sections 74-76), **tout est maintenant implémenté** :

**MVP (V1) :** catalogue, catégories, prix dégressifs par palier, panier, commande invité et compte, adresses, calcul des frais par zone, 3 modes de paiement, cycle de vie complet de la commande, stock réservé/déduit automatiquement, dashboard admin, gestion produits/catégories/zones/livreurs/commandes, espace livreur avec code de confirmation et encaissement espèces, notifications in-app, avis clients, favoris, code promo, points de fidélité, statistiques de base.

**Phase 2 (section 75) :**
- Carte interactive + GPS (sélection d'adresse sur carte, partage de position)
- Suivi livreur en temps réel (position GPS envoyée périodiquement, visible côté client pendant la livraison)
- Notifications SMS et WhatsApp (architecture complète, voir `src/integrations/sms.js` et `whatsapp.js` — appels réels à brancher avec vos identifiants)
- Promotions / codes promo (fait dès le MVP)
- Factures PDF générées côté serveur (`GET /api/orders/:id/invoice.pdf`, via `pdfkit`)
- Commandes programmées (`scheduledAt`) et **commandes récurrentes** (abonnement hebdo/bimensuel/mensuel, génération automatique via tâche planifiée quotidienne — voir `src/jobs/recurringOrders.job.js`)
- Clients professionnels + tarifs grossistes (demande côté client, approbation admin avec remise % appliquée automatiquement au prix dégressif)
- Gestion des dépenses (fait dès le MVP)
- Statistiques avancées (voir Phase 3 ci-dessous)

**Phase 3 (section 76) :**
- Attribution automatique du livreur le moins chargé quand une commande passe "Prête" (`src/utils/driverAssignment.js`), avec possibilité de réassignation manuelle
- Recommandations produits ("les clients ont aussi acheté", basé sur la co-occurrence dans les commandes, avec repli sur la catégorie si pas assez de données)
- Prévision de rupture de stock (moyenne mobile des ventes sur 14 jours)
- Détection d'anomalies (écart-type sur commandes/CA/taux d'annulation quotidien)
- Business Intelligence : marge par produit (nécessite le champ `costPrice`), meilleurs clients, performance des livreurs (délai moyen, écarts de caisse), analyse géographique

**Bonus suggéré et implémenté :** programme de parrainage (code de parrainage automatique à l'inscription, bonus de points de fidélité au parrain lors de la première commande livrée du filleul).

Le détail des endpoints ajoutés est visible dans `src/routes/`. Aucune fonctionnalité du cahier des charges (sections 1 à 76) ne reste à l'état de simple schéma : tout ce qui pouvait être branché sans dépendre d'identifiants tiers que vous seul pouvez obtenir (MTN/Orange, SMS, WhatsApp) est pleinement fonctionnel.

## 5. Paiement Mobile Money, SMS et WhatsApp

Ces trois intégrations suivent le même principe honnête : l'architecture est complète (modèles de données, endpoints, logique métier, notification best-effort qui n'échoue jamais silencieusement l'action principale), mais l'appel réel au fournisseur externe nécessite des identifiants que vous seul pouvez obtenir :

- MTN MoMo Collections : https://momodeveloper.mtn.com
- Orange Money Web Payment : https://developer.orange.com
- SMS (ex. Africa's Talking, Twilio) : voir `src/integrations/sms.js`
- WhatsApp Business Cloud API (Meta) : voir `src/integrations/whatsapp.js`

Les paiements Mobile Money sont **réellement codés** (`src/integrations/mtnMomo.js`, `orangeMoney.js`, `src/services/payment.service.js`) :

| Environnement | Comportement |
|---|---|
| `NODE_ENV=production` | Vraies API MTN MoMo / Orange Money. **Aucune simulation.** Si une clé manque, le paiement affiche « Erreur de développement : … clés manquantes : … » (et le site bloque la commande Mobile Money). La route `/api/payments/:id/simulate` répond 404. |
| autre (développement) | Si les clés sont absentes, un **simulateur** remplace l'opérateur ; la page de confirmation propose « Simuler un paiement réussi / un échec ». |

À renseigner dans les variables d'environnement de l'hébergeur (voir `.env.example`) : `API_PUBLIC_URL`, `CLIENT_URL`, `MTN_MOMO_API_URL`, `MTN_MOMO_API_USER`, `MTN_MOMO_API_KEY`, `MTN_MOMO_SUBSCRIPTION_KEY`, `MTN_MOMO_TARGET_ENVIRONMENT`, `ORANGE_MONEY_API_URL`, `ORANGE_MONEY_API_KEY`, `ORANGE_MONEY_API_SECRET`, `ORANGE_MONEY_MERCHANT_KEY`. `GET /api/payments/config` indique l'environnement et les clés manquantes ; le rapport est aussi écrit dans les logs au démarrage.

- **MTN MoMo** : demande de paiement (RequestToPay) → validation par code PIN sur le téléphone → statut vérifié auprès de MTN (interrogation à chaque sondage de la page + callback `POST /api/payments/webhook/mtn`).
- **Orange Money** : l'API renvoie une page de paiement, le client y est redirigé puis revient sur `/commande-confirmee/:id` ; statut confirmé par `transactionstatus` et notification `POST /api/payments/webhook/orange/:orderId` (jeton `notif_token` vérifié).
- Une notification d'opérateur n'est jamais crue sur parole : le statut est toujours re-vérifié auprès de l'opérateur. Les confirmations sont idempotentes.
- **Espèces** : réservées aux clients **avec compte** ayant déjà **payé plus de 2 commandes** (donc 3 et plus) via MTN/Orange — règle appliquée côté serveur (`src/services/cash.service.js`) ; `GET /api/orders/cash-eligibility` renseigne l'écran de paiement.

## 6. Ce qui reste hors périmètre (section 77 "fonctionnalités futures", au-delà de la Phase 3)

Applications Android/iOS natives, PWA avancée (le manifeste + service worker de base sont fournis côté frontend), multi-villes/multi-entreprises/marketplace, chatbot. Ces éléments impliquent soit une plateforme différente (apps natives), soit une refonte architecturale majeure (multi-tenant), et n'étaient pas listés dans les Phases 2/3 explicitement demandées.

## 7. Connexion Google (« Continuer avec Google »)

1. Sur <https://console.cloud.google.com/apis/credentials>, créez un **ID client
   OAuth** de type **Application Web**.
2. Dans **Origines JavaScript autorisées**, ajoutez l'adresse exacte du site
   (ex. `https://fresh-fish-sarl.vercel.app`, et `http://localhost:5173` pour
   le développement). Aucune URI de redirection n'est nécessaire.
3. Copiez l'ID client dans `GOOGLE_CLIENT_ID` (backend) **et** dans
   `VITE_GOOGLE_CLIENT_ID` (frontend, même valeur).

Si `GOOGLE_CLIENT_ID` est vide, le bouton est simplement masqué : le reste du
site fonctionne normalement. Un client qui s'inscrit avec Google n'a pas encore
de numéro de téléphone : il lui est demandé au moment de la commande (et rappelé sur son espace client).

## 8. Mots de passe oubliés et réinitialisation par l'administrateur

- **Page « Mot de passe oublié »** : envoie un code à 6 chiffres par SMS. Tant
  qu'aucun fournisseur SMS n'est branché (`src/integrations/sms.js`), le code
  n'est **pas** réellement envoyé : il apparaît dans les journaux du serveur
  (`[sms:simule] -> ...`) et la page propose au client de vous écrire sur
  WhatsApp.
- **Réinitialisation par l'administrateur** (la solution à utiliser tant que
  le SMS n'est pas branché) : *Admin > Clients* ou *Admin > Livreurs*, bouton
  **Mot de passe** → un mot de passe provisoire est créé et affiché **une seule
  fois**, avec un bouton « Envoyer par WhatsApp ». La personne le change
  ensuite depuis son profil. Un client inscrit uniquement avec Google n'a pas
  de mot de passe à réinitialiser (le serveur répond 400 dans ce cas).
- **Création d'un livreur** (*Admin > Livreurs > Ajouter un livreur*) : le
  téléphone sert d'identifiant ; le mot de passe provisoire choisi (ou généré)
  s'affiche une fois, avec le message WhatsApp prêt à envoyer.

## 9. Endpoints utilisés par le back-office

| Besoin | Endpoint |
|---|---|
| Liste des commandes (onglets, compteurs, recherche, dates) | `GET /api/orders` (`group`, `status`, `payment`, `paymentStatus`, `zone`, `search`, `from`, `to`, `page`, `limit`) |
| Export CSV des commandes | `GET /api/orders/export.csv` (mêmes filtres) |
| Statut, annulation, livreur | `PATCH /api/orders/:id/status`, `POST /api/orders/:id/cancel`, `POST /api/orders/:id/assign-driver`, `POST /api/orders/:id/auto-assign-driver` |
| Facture PDF | `GET /api/orders/:id/invoice.pdf` |
| Paiements | `GET /api/payments`, `POST /api/payments/:orderId/mark-paid`, `POST /api/payments/:orderId/mark-refunded` |
| Livreurs | `GET/POST /api/drivers`, `PATCH /api/drivers/:id`, `POST /api/drivers/:id/reset-password`, `GET /api/drivers/deliveries` |
| Clients | `GET /api/customers`, `PATCH /api/customers/:id/professional-status`, `POST /api/customers/:id/reset-password` |
| Stock | `PATCH /api/products/:id/stock` (`quantity` positive ou négative, `reason` facultatif ; refusé si le stock deviendrait négatif) |
| Notifications | `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `POST /api/notifications/read-all` |
| Statistiques | `GET /api/statistics/dashboard`, `/sales`, `/products`, `/payment-breakdown` |

Règles à connaître :

- **Mobile Money** : « Marquer payé » enregistre le paiement **et** passe la
  commande de « En attente » à « Confirmée ». Pour les **espèces**, il
  enregistre seulement l'encaissement (la commande suit son cours normal).
- **Remboursements** : « Marquer remboursé » ne fait que **noter** qu'un
  remboursement a été effectué (commande annulée et déjà payée). Le
  remboursement lui-même (renvoi de l'argent au client par MoMo / Orange Money)
  se fait à la main, hors de la plateforme.
- **Livreur** : on ne peut assigner qu'un livreur actif (ni suspendu, ni compte
  désactivé). Passer une commande à « Prête » assigne automatiquement le
  livreur disponible le moins chargé ; s'il n'y en a aucun, la commande reste
  « Prête » et vous l'assignez à la main. Une livraison signalée « non livrée »
  par le livreur peut être relancée (même livreur ou un autre).
- **Dates et statistiques** sont calculées à l'heure de **Douala (UTC+1)**.
  Les filtres de dates `du` / `au` incluent le jour de fin.
- **Remise grossiste** d'un compte professionnel : entier de 0 à 50 %.

## Structure

```
src/
├── config/        # client Prisma
├── controllers/    # logique métier par domaine
├── routes/         # définition des endpoints REST
├── middlewares/     # auth JWT, rôles, validation, erreurs
├── validators/     # schémas Zod
├── integrations/   # points d'intégration MTN MoMo / Orange Money
├── utils/          # helpers (JWT, prix dégressifs, générateurs, notifications)
├── app.js
└── server.js
prisma/
├── schema.prisma
└── seed.js
```
