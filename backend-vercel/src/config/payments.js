// Configuration des paiements Mobile Money : environnement (developpement / production),
// cles API requises par operateur et mode d'execution.
//
//  - PRODUCTION (NODE_ENV=production) : les vraies API MTN MoMo / Orange Money sont appelees. Si les
//    cles ne sont pas encore renseignees dans l'environnement de l'hebergeur, le paiement est refuse
//    avec un message d'erreur de developpement explicite (jamais de simulation).
//  - DEVELOPPEMENT (tout autre NODE_ENV) : si les cles sont absentes, un simulateur remplace
//    l'operateur et les routes de simulation sont disponibles pour tester le site.
const ApiError = require('../utils/ApiError');

const isProduction = () => process.env.NODE_ENV === 'production';
const isDevelopment = () => !isProduction();

const has = (name) => typeof process.env[name] === 'string' && process.env[name].trim() !== '';
const env = (name, fallback = '') => (has(name) ? process.env[name].trim() : fallback);
const stripSlash = (value) => String(value || '').replace(/\/+$/, '');

// URL publique de l'API (pour les notifications des operateurs) et du site client (retour de paiement).
const apiPublicUrl = () => stripSlash(env('API_PUBLIC_URL'));
const clientUrl = () => stripSlash(env('CLIENT_URL') || env('FRONTEND_URL').split(',')[0].trim());

const PROVIDERS = {
  MTN_MOMO: {
    label: 'MTN Mobile Money',
    required: ['MTN_MOMO_API_URL', 'MTN_MOMO_API_USER', 'MTN_MOMO_API_KEY', 'MTN_MOMO_SUBSCRIPTION_KEY', 'MTN_MOMO_TARGET_ENVIRONMENT'],
    // Ne bloque pas : sans API_PUBLIC_URL on s'en remet a l'interrogation du statut aupres de MTN.
    optional: ['MTN_MOMO_CURRENCY', 'API_PUBLIC_URL'],
  },
  ORANGE_MONEY: {
    label: 'Orange Money',
    required: ['ORANGE_MONEY_API_URL', 'ORANGE_MONEY_API_KEY', 'ORANGE_MONEY_API_SECRET', 'ORANGE_MONEY_MERCHANT_KEY', 'API_PUBLIC_URL'],
    optional: ['ORANGE_MONEY_CURRENCY', 'ORANGE_MONEY_TOKEN_URL', 'CLIENT_URL'],
  },
};

const METHODS = Object.keys(PROVIDERS);

function missingKeys(method) {
  const provider = PROVIDERS[method];
  if (!provider) return [];
  const missing = provider.required.filter((name) => !has(name));
  // Orange Money redirige le client vers sa page de paiement puis vers le site : il faut l'URL du site.
  if (method === 'ORANGE_MONEY' && !clientUrl()) missing.push('CLIENT_URL (ou FRONTEND_URL)');
  return missing;
}

const isConfigured = (method) => missingKeys(method).length === 0;

// 'live'       : vraie API de l'operateur
// 'simulation' : simulateur (developpement uniquement, cles absentes ou PAYMENT_SIMULATION=on)
function resolveMode(method) {
  if (!PROVIDERS[method]) throw new ApiError(400, 'Mode de paiement mobile inconnu');
  if (isDevelopment() && (!isConfigured(method) || env('PAYMENT_SIMULATION').toLowerCase() === 'on')) return 'simulation';
  if (isConfigured(method)) return 'live';
  throw notConfiguredError(method);
}

function notConfiguredError(method) {
  const missing = missingKeys(method);
  return new ApiError(
    503,
    `Erreur de développement : le paiement ${PROVIDERS[method].label} n'est pas encore configuré (clés manquantes : ${missing.join(', ')}). ` +
      "Ajoutez-les dans les variables d'environnement de l'hébergeur puis redéployez.",
    { code: 'PAYMENT_NOT_CONFIGURED', method, missing }
  );
}

// Etat transmis au frontend (GET /api/payments/config).
function publicConfig() {
  const methods = {};
  for (const method of METHODS) {
    const missing = missingKeys(method);
    methods[method] = {
      label: PROVIDERS[method].label,
      configured: missing.length === 0,
      simulated: isDevelopment() && (missing.length > 0 || env('PAYMENT_SIMULATION').toLowerCase() === 'on'),
      missing,
    };
  }
  return { environment: isProduction() ? 'production' : 'development', simulationEnabled: isDevelopment(), methods };
}

// Reserve aux routes de test : introuvables en production.
function devOnly(req, res, next) {
  if (!isDevelopment()) return next(new ApiError(404, `Route introuvable : ${req.method} ${req.originalUrl}`));
  return next();
}

// Rapport au demarrage (visible dans les logs de l'hebergeur).
function logStartupReport() {
  const env_ = isProduction() ? 'PRODUCTION' : 'DEVELOPPEMENT';
  for (const method of METHODS) {
    const missing = missingKeys(method);
    if (missing.length === 0) {
      console.log(`[paiements] ${PROVIDERS[method].label} : configuré (${env_})`);
    } else if (isProduction()) {
      console.error(`[paiements] ERREUR : ${PROVIDERS[method].label} non configuré en production — clés manquantes : ${missing.join(', ')}`);
    } else {
      console.warn(`[paiements] ${PROVIDERS[method].label} : simulateur actif (développement) — clés manquantes : ${missing.join(', ')}`);
    }
  }
  if (isProduction() && /change-moi|secret$/i.test(env('JWT_SECRET', 'change-moi'))) {
    console.error('[securite] JWT_SECRET absent ou par défaut en production : définissez une longue chaîne aléatoire.');
  }
}

module.exports = {
  PROVIDERS,
  METHODS,
  isProduction,
  isDevelopment,
  env,
  has,
  stripSlash,
  apiPublicUrl,
  clientUrl,
  missingKeys,
  isConfigured,
  resolveMode,
  notConfiguredError,
  publicConfig,
  devOnly,
  logStartupReport,
};
