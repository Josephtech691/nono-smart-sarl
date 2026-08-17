# NONO SMART SARL — API backend

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
| Admin   | 659103000   | admin@nonosmart.cm       |
| Livreur | 674331099   | jean.livreur@nonosmart.cm|
| Client  | 690000000   | client@demo.cm           |

**À changer immédiatement en production** — ce sont des identifiants de démonstration.

## 2. Déploiement sur Render

Deux options :

### Option A — Blueprint (`render.yaml`, recommandé)

1. Poussez ce repo sur GitHub.
2. Dans le dashboard Render : **New > Blueprint**, sélectionnez le repo. Render lit
   `backend/render.yaml` et crée automatiquement le service web et la base Postgres.
3. Render vous demandera de renseigner les variables marquées `sync: false`
   (`FRONTEND_URL`, clés MTN/Orange) — `FRONTEND_URL` doit être l'URL Vercel du frontend
   (ex: `https://nono-smart.vercel.app`).
4. `JWT_SECRET` est généré automatiquement par Render.

### Option B — Manuelle

1. **New > PostgreSQL** sur Render → notez la `Internal Connection String`.
2. **New > Web Service** → connectez le repo, `Root Directory` = `backend`.
3. Build command : `npm install && npx prisma migrate deploy`
4. Start command : `npm start`
5. Ajoutez les variables d'environnement de `.env.example` (au minimum
   `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`, `FRONTEND_URL`).
6. Une fois déployé, lancez le seed une fois via le Shell Render : `npm run seed`.

> ⚠️ **Base Postgres gratuite Render** : elle expire automatiquement 30 jours après
> sa création (14 jours de grâce ensuite avant suppression définitive). Pratique
> pour développer et présenter le projet, mais il faudra passer sur un plan payant
> avant l'expiration pour un usage réel. Le service web gratuit se met aussi en
> veille après 15 minutes d'inactivité (le premier appel après une veille prend
> ~1 minute). Vérifiez les tarifs actuels sur render.com avant de choisir un plan.

## 3. Paiement Mobile Money (MTN / Orange)

Le cahier des charges impose (section 20) que le paiement ne soit **jamais**
validé uniquement depuis le navigateur. C'est respecté ici : chaque commande crée
un `Payment` en base, et seul le backend peut le faire passer à `PAID`.

En revanche, les appels réels aux API MTN Mobile Money et Orange Money nécessitent
des identifiants marchand que vous seul pouvez obtenir :

- MTN MoMo Collections : https://momodeveloper.mtn.com
- Orange Money Web Payment : https://developer.orange.com

En attendant, `src/integrations/mtnMomo.js` et `src/integrations/orangeMoney.js`
simulent une demande de paiement initiée avec succès, ce qui permet de tester tout
le tunnel (commande → paiement → confirmation → livraison) de bout en bout. Une
route `POST /api/payments/:orderId/simulate` (désactivée si `NODE_ENV=production`)
permet à un admin de forcer la confirmation en local pendant les tests.

**À faire avant mise en production réelle :** remplacer le contenu de ces deux
fichiers par les vrais appels API, et ajouter un endpoint de callback/webhook pour
recevoir la confirmation asynchrone des opérateurs.

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

En attendant, chaque intégration journalise/simule un envoi réussi, ce qui permet de tester tout le tunnel de bout en bout. Une route `POST /api/payments/:orderId/simulate` (désactivée si `NODE_ENV=production`) permet à un admin de forcer la confirmation d'un paiement en local pendant les tests.

## 6. Ce qui reste hors périmètre (section 77 "fonctionnalités futures", au-delà de la Phase 3)

Applications Android/iOS natives, PWA avancée (le manifeste + service worker de base sont fournis côté frontend), multi-villes/multi-entreprises/marketplace, chatbot. Ces éléments impliquent soit une plateforme différente (apps natives), soit une refonte architecturale majeure (multi-tenant), et n'étaient pas listés dans les Phases 2/3 explicitement demandées.

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
