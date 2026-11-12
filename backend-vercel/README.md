# Fresh Fish — API backend (variante Vercel)

Même API, même base de code fonctionnelle que `backend/` (déploiement Render),
adaptée pour tourner **sans problème** sur Vercel au cas où Render vous
poserait souci. Les deux variantes partagent le même schéma de base de
données : vous pouvez basculer de l'une à l'autre sans toucher au frontend
(juste `VITE_API_URL`).

## Pourquoi ce n'est pas juste un copier-coller

Render fait tourner votre backend comme un **process Node persistant** (un
vrai serveur qui reste allumé). Vercel fonctionne en **serverless** : chaque
requête déclenche l'exécution d'une fonction à la demande, qui peut être
recréée à tout moment. Trois conséquences concrètes, déjà traitées ici :

1. **Point d'entrée** : `src/app.js` exporte l'application Express (sans
   `app.listen()`) — c'est le format que Vercel détecte et déploie
   automatiquement, sans aucune configuration (voir [doc officielle
   Vercel](https://vercel.com/docs/frameworks/backend/express)). Le fichier
   `scripts/local-dev.js` (avec `app.listen()`) sert uniquement au
   développement local via `npm run dev` — Vercel ne l'utilise jamais.
2. **Tâche planifiée (commandes récurrentes)** : impossible de garder un
   `node-cron` en mémoire puisqu'aucun process ne reste allumé en continu.
   À la place, un **Vercel Cron Job** (configuré dans `vercel.json`) appelle
   chaque jour `GET /api/cron/recurring-orders`, sécurisé par `CRON_SECRET`.
3. **Connexions à la base de données** : sur Render, un seul process garde
   une poignée de connexions ouvertes. Sur Vercel, chaque invocation de
   fonction pourrait en théorie ouvrir sa propre connexion Postgres et vite
   épuiser la limite de votre base. `src/config/db.js` met en cache le
   client Prisma via `globalThis` pour limiter ça, **mais il faut en plus
   utiliser une base de données avec un pooler de connexions** (voir plus bas).

## 1. Choisir une base de données compatible serverless

Contrairement à la variante Render (qui peut utiliser Postgres directement),
utilisez ici un fournisseur avec un **pooler de connexions** intégré :

### Option A — Neon (recommandé, gratuit pour démarrer)

1. Créez un projet sur [neon.tech](https://neon.tech).
2. Dans le dashboard, copiez **deux** chaînes de connexion :
   - La connexion **"Pooled connection"** (contient `-pooler` dans l'hôte) → `DATABASE_URL`
   - La connexion **directe** (sans `-pooler`) → `DIRECT_URL`
3. Ajoutez `&connection_limit=1` à la fin de `DATABASE_URL`.

### Option B — Supabase

1. Créez un projet sur [supabase.com](https://supabase.com).
2. **Project Settings > Database > Connection pooling** : copiez l'URL du
   pooler en **mode transaction** (port `6543`) → `DATABASE_URL`, ajoutez
   `?pgbouncer=true&connection_limit=1`.
3. Copiez la connexion directe (port `5432`) → `DIRECT_URL`.

### Option C — Aiven for PostgreSQL

Hébergeur sérieux (sauvegardes, chiffrement, extensions), mais lisez ces points
avant de choisir une formule (chiffres de la documentation Aiven, à revérifier
sur [aiven.io](https://aiven.io/docs/products/postgresql/concepts/pg-free-tier)) :

- **Formule gratuite** : 1 Go, 1 vCPU / 1 Go de RAM, **20 connexions maximum**,
  **pas de pooler**, un seul service gratuit par organisation, sans carte
  bancaire. Aiven peut **mettre le service en pause s'il reste inactif**
  (notification préalable, redémarrage manuel) : adaptée aux tests, pas à une
  boutique en production.
- **Formule Developer** (annoncée en novembre 2025, à partir de 5 $/mois) :
  jusqu'à 8 Go, pas de mise en pause automatique, sauvegardes quotidiennes ;
  **15 connexions maximum** et toujours pas de pooler (le pooler est réservé aux
  formules Startup et au-dessus).
- Copiez l'URI de connexion fournie par Aiven (elle se termine par
  `?sslmode=require`) dans `DATABASE_URL` **et** `DIRECT_URL`, et ajoutez
  `&connection_limit=1` à `DATABASE_URL`.
- Sans pooler et avec 15 à 20 connexions, le mode serverless de Vercel peut
  saturer la base si beaucoup de visiteurs arrivent en même temps : pour Aiven,
  la variante **Render** (`backend/`, un process unique) est plus adaptée.
- Placez la base dans une région **Europe** et, si possible, choisissez la
  région des fonctions Vercel la plus proche de la base.

### Option D — Réutiliser la base Render existante

Fonctionne aussi (même schéma), mais sans pooler dédié vous risquez des
erreurs de connexion sous charge. Utilisez la même URL pour `DATABASE_URL`
et `DIRECT_URL` en dernier recours.

## 2. Déploiement sur Vercel

> ℹ️ **Migrations fournies.** Le dossier `prisma/migrations/` contient déjà la
> migration initiale (`20260810120000_init`) et celle de la connexion Google
> (`20260827000000_google_oauth`). Le script `vercel-build` (`prisma generate &&
> prisma migrate deploy`) les applique à chaque déploiement : la base est
> créée toute seule au premier déploiement. Il ne reste qu'à la remplir une
> fois (étape 7).

1. Poussez ce repo sur GitHub (dossier `backend-vercel/` à la racine, ou seul repo).
2. Sur [vercel.com](https://vercel.com) : **Add New > Project**, importez le repo.
3. **Root Directory** : `backend-vercel` (si le repo contient aussi le frontend).
4. **Framework Preset** : Vercel détecte Express automatiquement — rien à changer.
5. Ajoutez les variables d'environnement (Project Settings > Environment
   Variables) : au minimum `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`,
   `FRONTEND_URL` (URL Vercel exacte du frontend, sans slash final), `CRON_SECRET`.
   Copiez le reste de `.env.example` selon vos besoins.
6. Déployez. Le script `vercel-build` (`prisma generate && prisma migrate
   deploy`) crée les tables au premier déploiement, puis n'applique que les
   nouvelles migrations aux suivants.
7. **Une seule fois, sur votre ordinateur**, dans `backend-vercel`, avec
   `DATABASE_URL` / `DIRECT_URL` de `.env` pointés vers votre base de production :
   ```bash
   npm install
   npm run seed          # categories/produits/zones/comptes demo (repart de zero : base neuve uniquement)
   ```
   Sur une base déjà remplie, utilisez plutôt `npm run seed:catalog` : il
   n'ajoute que les variantes de silure manquantes et n'efface rien.
   Quand vous modifiez `prisma/schema.prisma`, générez une migration avec
   `npx prisma migrate dev --name <description>` et committez
   `prisma/migrations/` : le déploiement suivant l'applique automatiquement.

Votre API est disponible sur `https://<votre-projet>.vercel.app/api/...`.
Vérifiez avec `GET /api/health`.

## 3. Le Cron Job (commandes récurrentes)

`vercel.json` déclare :

```json
{ "crons": [{ "path": "/api/cron/recurring-orders", "schedule": "0 6 * * *" }] }
```

- Exécuté tous les jours à 6h **UTC**, uniquement sur les déploiements de
  **production** (pas sur les previews).
- Le plan gratuit (Hobby) autorise jusqu'à 2 cron jobs à fréquence quotidienne
  minimum — largement suffisant ici.
- Pour tester manuellement sans attendre l'horaire :
  ```bash
  vercel crons run /api/cron/recurring-orders
  ```
  ou directement :
  ```bash
  curl -H "Authorization: Bearer VOTRE_CRON_SECRET" https://votre-projet.vercel.app/api/cron/recurring-orders
  ```

## 4. Différences de comportement à connaître

- **Rate limiting** (`express-rate-limit`) : fonctionne, mais son stockage en
  mémoire est moins fiable en serverless (il peut se réinitialiser entre les
  invocations de fonction). Cela reste une protection de base utile, mais pour
  une protection anti-abus plus robuste à grande échelle, envisagez un store
  partagé (ex: Upstash Redis, compatible avec `express-rate-limit` via
  `rate-limit-redis`).
- **Durée d'exécution** : les fonctions Vercel ont une limite de durée
  (300s par défaut en 2026, largement suffisant pour toutes les routes de
  cette API).
- **Démarrage à froid** : la toute première requête après une période
  d'inactivité peut être un peu plus lente (cold start), comme sur Render en
  plan gratuit.

## 5. Tout le reste est identique

Routes, contrôleurs, logique métier, sécurité, intégrations MTN/Orange/SMS/
WhatsApp (mêmes stubs honnêtes à brancher avec vos identifiants), génération
de factures PDF, statistiques avancées : **tout le contenu de
`backend/README.md` (sections 4 à 6) s'applique ici sans changement.**
Consultez-le pour le détail des fonctionnalités Phase 1/2/3 implémentées.

## 6. Développement local

```bash
npm install
cp .env.example .env    # completez au moins DATABASE_URL, DIRECT_URL, JWT_SECRET
docker compose up -d    # Postgres local (ou pointez directement vers Neon/Supabase)
npx prisma migrate dev --name init
npm run seed
npm run dev              # http://localhost:4000, via scripts/local-dev.js
```

Vous pouvez aussi utiliser `vercel dev` (après `vercel link`) pour un
environnement local qui simule fidèlement l'exécution serverless, y compris
le déclenchement manuel du cron via `vercel crons run`.

## Paiements Mobile Money

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
