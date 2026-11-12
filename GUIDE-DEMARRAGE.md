# Fresh Fish — Plateforme e-commerce silures & alevins

Guide de démarrage. Le projet est livré dans **un seul zip** (`fresh-fish-complet.zip`)
qui contient trois dossiers, conformes à l'architecture du cahier des charges
(React/Vite/Tailwind + Node/Express/Prisma/PostgreSQL), et ce guide :

- `backend/` → API pour **Render** (process persistant)
- `backend-vercel/` → **la même API**, adaptée pour **Vercel** (serverless) —
  à utiliser si Render vous pose problème. Les deux variantes partagent le même
  schéma de base de données et exposent exactement les mêmes routes ; vous
  n'avez besoin que d'**une seule** des deux en production.
- `frontend/` → Application React (à déployer sur Vercel)

Chaque dossier contient son propre `README.md` détaillé. Voici l'essentiel.

## Fresh Fish : paiements réels, espèces, trois applications

- **Marque** : le site, les e-mails, les factures et les noms techniques s'appellent désormais **Fresh Fish** ; le logo est la photo du silure (`frontend/public/brand/`, icônes PWA dans `public/icons/`).
- **Paiement** : logos MTN MoMo et Orange Money (`frontend/public/payment/`) sur l'écran de paiement et dans le pied de page.
- **Paiements Mobile Money branchés pour la production** : renseignez les clés dans les variables d'environnement de l'hébergeur (liste dans `backend*/.env.example`). En production, une clé manquante donne un message « Erreur de développement » ; le **simulateur n'existe qu'en développement** (`NODE_ENV` différent de `production`). Détails : `backend/README.md` § paiements.
- **Espèces** : proposées seulement aux clients **ayant un compte** et ayant déjà **payé plus de 2 commandes par Mobile Money** (règle vérifiée côté serveur).
- **Pied de page** : plus de lien vers l'administration ni l'espace livreur. Dans le site complet (`npm run dev` / `npm run build`), `/admin/connexion` et `/livreur/connexion` restent accessibles à qui tape l'adresse.
- **Trois applications** à partir du même code frontend :

| Application | Développement | Build (dossier de sortie) | Port dev |
|---|---|---|---|
| Clients | `npm run dev:client` | `npm run build:client` → `dist/client` | 5173 |
| Livreurs | `npm run dev:driver` | `npm run build:driver` → `dist/driver` | 5175 |
| Admin | `npm run dev:admin` | `npm run build:admin` → `dist/admin` | 5174 |

  En production : un projet Vercel par application (root directory `frontend`, *Build Command* `npm run build:<app>`, *Output Directory* `dist/<app>`), puis listez les trois adresses dans `FRONTEND_URL` côté backend (séparées par des virgules) et renseignez `CLIENT_URL`. L'application clients ne contient aucune page admin ni livreur.

## Nouveautés de la version précédente

- **Back-office complet** : tableau de bord, commandes (onglets, compteurs, recherche,
  dates, export CSV), fiche commande (statut, livreur, annulation, facture PDF),
  **Livraisons**, **Paiements**, **Livreurs**, **Clients** (demandes de compte pro),
  **Produits** avec **ajustement du stock**.
- **Cloche de notifications** (site, administration, espace livreur) avec bulle à
  l'arrivée d'une nouvelle commande.
- **Connexion Google**, mot de passe oublié, réinitialisation par l'administrateur
  (mot de passe provisoire à transmettre par WhatsApp).
- **Livreur** : signalement d'une livraison impossible, relance par l'administrateur.
- **Catalogue** : variantes de silure (entier, nettoyé, découpé, gros, moyen, fumé)
  ajoutables sans rien effacer avec `npm run seed:catalog`.
- Corrections : enregistrement d'un produit avec une photo du site (`/products/…`),
  texte alternatif des images conservé, validation des modifications de livreur,
  remise grossiste toujours entière (0 à 50 %).

## Render ou Vercel pour le backend ?

|  | Render (`backend/`) | Vercel (`backend-vercel/`) |
|---|---|---|
| Modèle | Process Node persistant | Serverless (fonctions à la demande) |
| Commandes récurrentes | `node-cron` en mémoire | Vercel Cron Job → `/api/cron/recurring-orders` |
| Base de données | PostgreSQL classique | Nécessite un pooler de connexions |
| Mise en veille (plan gratuit) | Oui, ~15 min d'inactivité | Non (mais « cold start » à la première requête) |
| Déploiement | `render.yaml` en un clic | Zéro configuration (Express détecté automatiquement) |

Les deux fonctionnent : commencez par celle qui vous semble la plus simple et
gardez l'autre de côté en cas de souci.

## Quelle base de données ?

| Hébergeur | À savoir |
|---|---|
| **Render Postgres** | Le plan gratuit **expire au bout de 30 jours** (14 jours de grâce) : à passer en payant avant un vrai lancement. |
| **Neon / Supabase** | Pooler de connexions fourni : le bon choix avec la variante Vercel. |
| **Aiven** | Fiable (sauvegardes, chiffrement). Formule **gratuite** : 1 Go, **20 connexions**, pas de pooler, et le service peut être **mis en pause s'il reste inactif** → pour tester seulement. Formule **Developer** (à partir de 5 $/mois, annoncée en novembre 2025) : 8 Go, pas de mise en pause, mais **15 connexions** et toujours pas de pooler. Avec Aiven, préférez la variante **Render**. Détails dans `backend-vercel/README.md` (option C) ; vérifiez les tarifs sur aiven.io. |

Les migrations (création des tables) sont **fournies** dans `prisma/migrations/` :
elles s'appliquent toutes seules au déploiement.

## Démarrage en local (5 minutes)

```bash
# 1. Backend
unzip fresh-fish-complet.zip && cd fresh-fish/backend      # (ou le dossier où vous l'avez décompressé)
npm install
cp .env.example .env
docker compose up -d              # Postgres local
npx prisma migrate dev            # applique les migrations fournies
npm run seed                      # catégories, produits, zones, comptes démo
npm run dev                       # http://localhost:4000

# 2. Frontend (dans un autre terminal)
cd ../frontend
npm install
cp .env.example .env              # VITE_API_URL=http://localhost:4000/api
npm run dev                       # http://localhost:5173
```

Comptes de démonstration (mot de passe `password123`) : admin `659103000`,
livreur `674331099`, client `690000000`, **client professionnel** `691000000`
(remise grossiste de 8 % déjà approuvée, pour tester le tarif pro).
Espaces : client `/connexion`, administration `/admin/connexion`, livreur `/livreur/connexion` (à taper dans la barre d'adresse : aucun lien public n'y mène).

## Déploiement en production

**Ordre recommandé : backend d'abord (vous aurez besoin de son URL pour le
frontend), puis frontend.**

### 1. Backend → Render (option par défaut)

- Dans le dashboard Render : **New > Blueprint**, pointez sur votre repo GitHub.
  Render lit `backend/render.yaml` et crée le service web + une base PostgreSQL.
- Renseignez `FRONTEND_URL` (URL exacte du frontend, sans slash final) une fois
  l'URL Vercel connue.
- Après le premier déploiement, ouvrez le **Shell** du service et lancez
  `npm run seed` (une seule fois, sur une base neuve).
- Détails complets dans `backend/README.md`.

### 1bis. Backend → Vercel (si Render vous pose problème)

- Créez d'abord une base avec pooler (Neon, Supabase…).
- Sur Vercel : **Add New > Project**, root directory `backend-vercel`. Variables :
  `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `FRONTEND_URL`, `CRON_SECRET`…
- Les migrations s'exécutent à chaque déploiement ; lancez `npm run seed` une
  fois depuis votre ordinateur. Détails dans `backend-vercel/README.md`.

### 2. Frontend → Vercel

- **Add New Project**, root directory `frontend` (Vite détecté automatiquement).
- Variable `VITE_API_URL` = `https://<votre-api>/api`.
- Reportez l'URL Vercel du frontend dans `FRONTEND_URL` côté backend, sinon CORS
  bloquera les requêtes.

### 3. Connexion Google (facultatif)

1. <https://console.cloud.google.com/apis/credentials> → **ID client OAuth**, type
   **Application Web**.
2. **Origines JavaScript autorisées** : l'adresse exacte du site
   (`https://…vercel.app`, et `http://localhost:5173` en local). Pas d'URI de
   redirection.
3. Même ID client dans `GOOGLE_CLIENT_ID` (backend) **et** `VITE_GOOGLE_CLIENT_ID`
   (frontend). Vides, le bouton est simplement masqué.

## Ce qui est fonctionnel

**Site et compte client** : catalogue avec prix dégressifs (et tarif grossiste pour
les comptes pro approuvés) → panier → adresse (carte + GPS) → livraison immédiate
ou programmée (créneaux) → frais par zone → code promo → paiement (MTN MoMo /
Orange Money / espèces) → commande → suivi avec position du livreur → code de
confirmation → facture PDF → avis. Commandes récurrentes, favoris, parrainage,
points de fidélité, site installable (PWA).

**Administration (`/admin`)** :

| Page | Ce qu'on y fait |
|---|---|
| Tableau de bord | Commandes du jour, CA du mois, livraisons en cours, ventes par période, « À faire » cliquables |
| Commandes | Onglets avec compteurs, recherche, filtres, dates, export CSV |
| Fiche commande | Statut, livreur (manuel / auto), relance d'une livraison échouée, annulation avec motif, marquer payé / remboursé, facture PDF, historique |
| Livraisons | Qui livre quoi, « À assigner », « Problèmes », espèces à encaisser |
| Paiements | Encaissé / en attente / à rembourser, marquer payé ou remboursé |
| Livreurs | Disponibilité, charge, ajout, mot de passe provisoire, désactivation |
| Clients | Demandes de compte pro (remise 0–50 %), mot de passe provisoire |
| Produits | Stock (entrée/sortie ou inventaire), prix dégressifs, coût d'achat, images |
| Catégories, Zones, Avis, Promotions, Statistiques, Finances | Gestion et analyses (marges, meilleurs clients, prévision de rupture, anomalies) |

**Espace livreur (`/livreur`)** : livraisons du jour, appel client, itinéraire,
partage de position GPS, confirmation par code, encaissement espèces, signalement
d'un problème (client injoignable…).

## Mots de passe, livreurs et clients

- **Ajouter un livreur** : *Admin > Livreurs > Ajouter un livreur*. Le téléphone sert
  d'identifiant ; le mot de passe provisoire s'affiche **une seule fois**, avec un
  bouton « Envoyer par WhatsApp ».
- **Mot de passe oublié** : aucun fournisseur SMS n'est branché, donc le code n'est pas
  réellement envoyé (il apparaît dans les journaux du serveur). Le client est invité à
  vous écrire sur WhatsApp ; vous lui créez un mot de passe provisoire depuis
  *Admin > Clients* (ou *Livreurs*) → **Mot de passe**. Un client inscrit avec Google
  n'a pas de mot de passe à réinitialiser.

## Points d'attention avant un vrai lancement commercial

1. **Mobile Money, SMS, WhatsApp** : les vrais appels aux API MTN MoMo, Orange Money,
   SMS et WhatsApp Business sont à brancher avec vos identifiants
   (`backend/src/integrations/`). **En attendant, la confirmation est manuelle** : le
   client choisit MoMo/Orange, la commande arrive avec « Paiement à vérifier » ; vous
   vérifiez la réception de l'argent puis cliquez **Marquer payé** (fiche commande ou
   page Paiements) : la commande passe alors à « Confirmée ».
2. **Remboursements** : « Marquer remboursé » ne fait que **noter** que vous avez
   remboursé le client. Le renvoi de l'argent se fait à la main (MoMo / Orange Money).
3. **Catalogue** : les prix des variantes viennent de la maquette ; **paliers, coûts
   d'achat, stocks et descriptions sont indicatifs** → ajustez-les (Admin > Produits).
   Le « silure fumé » figure sur la maquette mais pas dans le cahier des charges :
   désactivez-le si vous ne le vendez pas.
4. **Photos** : les variantes de silure réutilisent vos photos comme visuels
   provisoires. Remplacez-les par la photo réelle de chaque variante (Admin >
   Produits > Modifier > Images) et vérifiez que vous avez le droit d'utiliser
   commercialement toutes les images.
5. **Pages légales** (conditions générales, confidentialité) : ce sont des **modèles**
   à faire relire par un juriste et à compléter avec les informations réelles de la
   société avant la mise en ligne.
6. **Créneaux de livraison programmée** : proposition de ma part ; adaptez-les à vos
   horaires réels.
7. **Secrets** : changez `JWT_SECRET` et tous les mots de passe de démonstration.
8. **Coûts d'achat** : renseignez-les sur chaque produit pour des marges exactes.
9. **Plans gratuits** : Render met le service en veille après ~15 min et la base
   gratuite expire au bout de 30 jours ; Aiven gratuit peut se mettre en pause.
10. Les statistiques et filtres de dates sont calculés à l'heure de **Douala (UTC+1)**.

## À vérifier de bout en bout avant la mise en ligne

1. Commande invité en espèces → elle apparaît dans *Admin > Commandes* avec une notification.
2. Confirmer → préparer → **Prête** (le livreur disponible est assigné) → côté livreur :
   récupérer, livrer avec le code, encaisser → facture PDF.
3. Commande MoMo → « Paiement à vérifier » → **Marquer payé** → « Confirmée ».
4. Annuler une commande déjà payée → bandeau « À rembourser » → **Marquer remboursé**.
5. Livraison « non livrée » signalée par le livreur → bandeau sur la fiche → relancer.
6. *Admin > Livreurs* : ajouter un livreur, noter le mot de passe, se connecter sur
   `/livreur/connexion`.
7. Compte professionnel : demande côté client → *Admin > Clients > Demandes pro* → approuver
   avec une remise → vérifier les prix.
8. *Admin > Produits* : ajuster le stock (+25, puis un retrait supérieur au stock : refusé),
   onglet « Stock bas ».
9. Connexion Google (si activée) et réinitialisation d'un mot de passe par l'administrateur.

## Hors périmètre (section 77 du cahier des charges)

Applications Android/iOS natives, multi-villes, multi-entreprises, marketplace,
chatbot : elles impliquent une autre plateforme ou une refonte majeure, et ne
faisaient pas partie des Phases 2/3 demandées.
