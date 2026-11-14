# Application Android « Fresh Fish — clients »

Enveloppe native (Capacitor) du **site clients** : mêmes pages, même design, car c'est le même code (`frontend`, `npm run build:client`), embarqué dans l'application. La couche native (`src/native.js`) ajoute :
notifications push (bannière en haut puis volet du téléphone), glisser vers le bas pour rafraîchir, bouton retour Android, écran de démarrage, bandeau hors connexion.

> **Seule l'application des clients est publiée sur Google Play.** L'administration et les livreurs ne sont pas
> publics : ils utilisent leurs propres sites (adresses non communiquées), installables comme application depuis
> Chrome (« Ajouter à l'écran d'accueil »), et pensés pour le téléphone.

## Ce qu'il faut faire une seule fois

### 1. Firebase (notifications)
1. https://console.firebase.google.com → créer un projet « Fresh Fish ».
2. Ajouter une application **Android**, nom de package : `cm.freshfish.client` (identique à `capacitor.config.json` ; ne pourra plus changer après publication). Télécharger `google-services.json`.
3. Dans Termux : `base64 -w0 google-services.json` → copier le résultat (secret `GOOGLE_SERVICES_JSON_BASE64`, voir 3).
4. Firebase → ⚙ Paramètres du projet → *Comptes de service* → *Générer une clé privée* → fichier JSON. Le mettre sur une ligne : `tr -d '\n' < cle.json`. Ce texte va dans la variable **`FIREBASE_SERVICE_ACCOUNT`** du projet Vercel **backend** (puis redéployer).

### 2. Clé de signature (Google Play)
Dans Termux (`pkg install openjdk-21`) :
```
keytool -genkeypair -v -keystore release.jks -alias freshfish -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 release.jks
```
**Gardez `release.jks` et ses mots de passe en lieu sûr (jamais sur GitHub).** Perdue, la clé ne se remplace qu'avec l'aide de Google.

### 3. Secrets GitHub
Dépôt → *Settings → Secrets and variables → Actions → New repository secret* :

| Secret | Valeur |
|---|---|
| `VITE_API_URL` | `https://frechfishapi.vercel.app/api` |
| `GOOGLE_SERVICES_JSON_BASE64` | résultat de l'étape 1.3 |
| `ANDROID_KEYSTORE_BASE64` | résultat de `base64 -w0 release.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | mot de passe du keystore |
| `ANDROID_KEY_ALIAS` | `freshfish` |
| `ANDROID_KEY_PASSWORD` | mot de passe de la clé |

### 4. Backend (Vercel)
- `FRONTEND_URL` : ajouter `https://localhost` à la liste (adresse interne de l'application), par ex.
  `https://frechfish.vercel.app,https://localhost`
- `FIREBASE_SERVICE_ACCOUNT` (étape 1.4), puis redéployer. La migration `20261114000000_device_tokens` s'applique au déploiement.

## Construire l'application
GitHub → onglet **Actions** → *Android clients* → *Run workflow*. Au bout de ~10 min, section *Artifacts* :
- `fresh-fish-clients-debug-apk` : à installer sur un téléphone pour tester ;
- `fresh-fish-clients-aab` : le fichier à envoyer sur Google Play.

## Publier sur Google Play (liste)
- Compte développeur Google Play (paiement unique de 25 $).
- Fiche : icône 512×512, image de présentation 1024×500, au moins 2 captures d'écran du téléphone, description courte et longue.
- **URL de la politique de confidentialité** : `https://frechfish.vercel.app/confidentialite`.
- Formulaire « Sécurité des données » (collecte : nom, téléphone, e-mail, adresse, position, identifiants d'appareil pour les notifications) et questionnaire de classification du contenu.
- **Suppression de compte** : disponible dans *Mon compte → Mon profil → Supprimer mon compte*. Adresse web à indiquer dans le formulaire Google Play : `https://frechfish.vercel.app/suppression-compte`.
- Tester d'abord en « test interne » (jusqu'à 100 testeurs) ; les nouveaux comptes personnels doivent aussi passer par un test fermé avec au moins 12 testeurs pendant 14 jours avant la production.
- Les applications qui ne font qu'afficher un site peuvent être refusées : c'est pourquoi celle-ci apporte des fonctions natives (notifications push, retour Android, hors connexion, pull-to-refresh).

## Limites connues
- La connexion « Continuer avec Google » est masquée dans l'application (Google la refuse dans une WebView) ; téléphone/e-mail + mot de passe fonctionnent.
- Si les versions `^8.0.0` des plugins Capacitor n'existent pas encore pour vous, remplacez `^8` par `^7` dans `package.json`.
