# NONO SMART SARL — API backend (variante Vercel)

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

### Option C — Réutiliser la base Render existante

Fonctionne aussi (même schéma), mais sans pooler dédié vous risquez des
erreurs de connexion sous charge. Utilisez la même URL pour `DATABASE_URL`
et `DIRECT_URL` en dernier recours.

## 2. Déploiement sur Vercel

> ⚠️ **Étape obligatoire avant que l'API fonctionne : générer la migration
> initiale.** Le script `vercel-build` lance `prisma migrate deploy`, qui
> **applique** des migrations existantes mais n'en **génère** jamais. Aucune
> migration n'est fournie dans ce dépôt (impossible à générer sans être
> connecté à une vraie base de données). Sans l'étape 7 ci-dessous, la base
> reste vide et l'API renvoie des erreurs `The table ... does not exist`.

1. Poussez ce repo sur GitHub (dossier `backend-vercel/` à la racine, ou seul repo).
2. Sur [vercel.com](https://vercel.com) : **Add New > Project**, importez le repo.
3. **Root Directory** : `backend-vercel` (si le repo contient aussi le frontend).
4. **Framework Preset** : Vercel détecte Express automatiquement — rien à changer.
5. Ajoutez les variables d'environnement (Project Settings > Environment
   Variables) : au minimum `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`,
   `FRONTEND_URL` (URL Vercel exacte du frontend, sans slash final), `CRON_SECRET`.
   Copiez le reste de `.env.example` selon vos besoins.
6. Déployez. Le script `vercel-build` (`prisma generate && prisma migrate
   deploy`) s'exécute à chaque déploiement, mais n'a rien à appliquer tant que
   l'étape 7 n'a pas été faite au moins une fois.
7. **Sur votre ordinateur**, dans `backend-vercel`, avec `DATABASE_URL` /
   `DIRECT_URL` de `.env` pointés vers votre base Neon/Supabase de production :
   ```bash
   npm install
   npx prisma migrate dev --name init   # cree ET applique les tables
   npm run seed                          # categories/produits/zones/comptes demo
   ```
   Committez et poussez le dossier `prisma/migrations/` généré — les
   déploiements suivants l'appliqueront automatiquement via `vercel-build`.

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
