// Integration MTN Mobile Money - Collections API (RequestToPay).
// Portail developpeur : https://momodeveloper.mtn.com
//
// Variables d'environnement (a definir chez l'hebergeur) :
//   MTN_MOMO_API_URL               ex. https://proxy.momoapi.mtn.com (production) ou https://sandbox.momodeveloper.mtn.com
//   MTN_MOMO_API_USER              identifiant « API user » (UUID) cree pour votre abonnement Collections
//   MTN_MOMO_API_KEY               cle API generee pour cet API user
//   MTN_MOMO_SUBSCRIPTION_KEY      cle d'abonnement du produit Collections (Ocp-Apim-Subscription-Key)
//   MTN_MOMO_TARGET_ENVIRONMENT    sandbox | mtncameroon (valeur fournie par MTN pour la production)
//   MTN_MOMO_CURRENCY              facultatif : XAF par defaut (EUR en sandbox)
//   API_PUBLIC_URL                 facultatif : active la notification (callback) en plus de l'interrogation du statut
const crypto = require('crypto');
const ApiError = require('../utils/ApiError');
const cfg = require('../config/payments');

const TIMEOUT_MS = 20000;
let tokenCache = { token: null, expiresAt: 0 };

function settings() {
  const targetEnvironment = cfg.env('MTN_MOMO_TARGET_ENVIRONMENT', 'sandbox');
  return {
    baseUrl: cfg.stripSlash(cfg.env('MTN_MOMO_API_URL')),
    apiUser: cfg.env('MTN_MOMO_API_USER'),
    apiKey: cfg.env('MTN_MOMO_API_KEY'),
    subscriptionKey: cfg.env('MTN_MOMO_SUBSCRIPTION_KEY'),
    targetEnvironment,
    currency: cfg.env('MTN_MOMO_CURRENCY', targetEnvironment === 'sandbox' ? 'EUR' : 'XAF'),
    callbackUrl: cfg.apiPublicUrl() ? `${cfg.apiPublicUrl()}/api/payments/webhook/mtn` : null,
  };
}

// 6XXXXXXXX / +2376XXXXXXXX -> 2376XXXXXXXX (format MSISDN attendu par MTN).
function toMsisdn(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (/^[26]\d{8}$/.test(digits)) digits = `237${digits}`;
  if (!/^237[26]\d{8}$/.test(digits)) throw new ApiError(400, 'Numéro MTN Mobile Money invalide (ex. 6XX XXX XXX)');
  return digits;
}

async function http(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    throw new ApiError(502, 'MTN Mobile Money est momentanément injoignable. Réessayez dans un instant.');
  } finally {
    clearTimeout(timer);
  }
}

async function getAccessToken() {
  if (tokenCache.token && tokenCache.expiresAt > Date.now() + 30000) return tokenCache.token;
  const s = settings();
  const basic = Buffer.from(`${s.apiUser}:${s.apiKey}`).toString('base64');
  const res = await http(`${s.baseUrl}/collection/token/`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Ocp-Apim-Subscription-Key': s.subscriptionKey },
  });
  if (!res.ok) {
    console.error('[mtnMomo] echec d\'authentification', res.status, await res.text().catch(() => ''));
    throw new ApiError(502, 'MTN Mobile Money : authentification refusée (vérifiez les clés API).');
  }
  const data = await res.json();
  tokenCache = { token: data.access_token, expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000 };
  return tokenCache.token;
}

// Demande de paiement : le client recoit une demande de validation (code PIN) sur son telephone.
async function requestToPay({ amount, phoneNumber, externalId }) {
  const mode = cfg.resolveMode('MTN_MOMO');
  const msisdn = toMsisdn(phoneNumber);

  if (mode === 'simulation') {
    return {
      referenceId: `SIM-MTN-${crypto.randomUUID()}`,
      status: 'PENDING',
      simulated: true,
      raw: { simulated: true, amount, phoneNumber: msisdn, externalId },
    };
  }

  const s = settings();
  const token = await getAccessToken();
  const referenceId = crypto.randomUUID();
  const headers = {
    Authorization: `Bearer ${token}`,
    'X-Reference-Id': referenceId,
    'X-Target-Environment': s.targetEnvironment,
    'Ocp-Apim-Subscription-Key': s.subscriptionKey,
    'Content-Type': 'application/json',
  };
  if (s.callbackUrl && s.callbackUrl.startsWith('https://')) headers['X-Callback-Url'] = s.callbackUrl;

  const res = await http(`${s.baseUrl}/collection/v1_0/requesttopay`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      amount: String(Math.round(amount)),
      currency: s.currency,
      externalId,
      payer: { partyIdType: 'MSISDN', partyId: msisdn },
      payerMessage: `Commande ${externalId} - Fresh Fish`,
      payeeNote: externalId,
    }),
  });

  if (res.status !== 202) {
    const body = await res.text().catch(() => '');
    console.error('[mtnMomo] requesttopay refuse', res.status, body);
    throw new ApiError(502, 'MTN Mobile Money a refusé la demande de paiement. Vérifiez le numéro et réessayez.');
  }
  return { referenceId, status: 'PENDING', simulated: false, raw: { referenceId, amount, currency: s.currency, phoneNumber: msisdn, externalId } };
}

// Etat reel d'une demande aupres de MTN -> 'PAID' | 'FAILED' | 'PROCESSING'
async function getPaymentStatus(referenceId) {
  if (String(referenceId).startsWith('SIM-')) return { status: 'PROCESSING', raw: { simulated: true } };
  const s = settings();
  const token = await getAccessToken();
  const res = await http(`${s.baseUrl}/collection/v1_0/requesttopay/${encodeURIComponent(referenceId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Target-Environment': s.targetEnvironment,
      'Ocp-Apim-Subscription-Key': s.subscriptionKey,
    },
  });
  if (res.status === 404) return { status: 'PROCESSING', raw: { notFound: true } };
  if (!res.ok) throw new ApiError(502, 'Impossible de vérifier le paiement auprès de MTN pour le moment.');
  const data = await res.json();
  const status = data.status === 'SUCCESSFUL' ? 'PAID' : data.status === 'FAILED' ? 'FAILED' : 'PROCESSING';
  return { status, raw: { status: data.status, reason: data.reason || null, financialTransactionId: data.financialTransactionId || null } };
}

module.exports = { requestToPay, getPaymentStatus, toMsisdn };
