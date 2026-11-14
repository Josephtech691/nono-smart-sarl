// Integration Orange Money - Web Payment API (Cameroun).
// Portail developpeur : https://developer.orange.com
//
// Fonctionnement : l'API renvoie une adresse de paiement (payment_url) vers laquelle le client est
// redirige pour valider le paiement ; il revient ensuite sur le site. Le statut est confirme par
// notification (notif_url) ET par interrogation (transactionstatus) : on ne se fie jamais au seul
// contenu d'une notification.
//
// Variables d'environnement (a definir chez l'hebergeur) :
//   ORANGE_MONEY_API_URL        ex. https://api.orange.com/orange-money-webpay/cm/v1  (dev : .../dev/v1)
//   ORANGE_MONEY_API_KEY        Consumer Key de l'application Orange
//   ORANGE_MONEY_API_SECRET     Consumer Secret de l'application Orange
//   ORANGE_MONEY_MERCHANT_KEY   cle marchand Orange Money
//   ORANGE_MONEY_CURRENCY       facultatif : XAF par defaut (OUV pour l'environnement de test Orange)
//   ORANGE_MONEY_TOKEN_URL      facultatif : https://api.orange.com/oauth/v3/token par defaut
//   API_PUBLIC_URL              URL publique de l'API (notification), ex. https://api.exemple.com
//   CLIENT_URL                  URL du site client (retour de paiement), sinon 1re valeur de FRONTEND_URL
const crypto = require('crypto');
const ApiError = require('../utils/ApiError');
const cfg = require('../config/payments');

const TIMEOUT_MS = 20000;
let tokenCache = { token: null, expiresAt: 0 };

function settings() {
  return {
    baseUrl: cfg.stripSlash(cfg.env('ORANGE_MONEY_API_URL')),
    tokenUrl: cfg.env('ORANGE_MONEY_TOKEN_URL', 'https://api.orange.com/oauth/v3/token'),
    consumerKey: cfg.env('ORANGE_MONEY_API_KEY'),
    consumerSecret: cfg.env('ORANGE_MONEY_API_SECRET'),
    merchantKey: cfg.env('ORANGE_MONEY_MERCHANT_KEY'),
    currency: cfg.env('ORANGE_MONEY_CURRENCY', 'XAF'),
  };
}

function toLocalPhone(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('237') && digits.length === 12) digits = digits.slice(3);
  if (!/^[26]\d{8}$/.test(digits)) throw new ApiError(400, 'Numéro Orange Money invalide (ex. 6XX XXX XXX)');
  return digits;
}

async function http(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    throw new ApiError(502, 'Orange Money est momentanément injoignable. Réessayez dans un instant.');
  } finally {
    clearTimeout(timer);
  }
}

async function getAccessToken() {
  if (tokenCache.token && tokenCache.expiresAt > Date.now() + 30000) return tokenCache.token;
  const s = settings();
  const basic = Buffer.from(`${s.consumerKey}:${s.consumerSecret}`).toString('base64');
  const res = await http(s.tokenUrl, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    console.error('[orangeMoney] echec d\'authentification', res.status, await res.text().catch(() => ''));
    throw new ApiError(502, 'Orange Money : authentification refusée (vérifiez les clés API).');
  }
  const data = await res.json();
  tokenCache = { token: data.access_token, expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000 };
  return tokenCache.token;
}

// `orderRef` : identifiant unique cote Orange (30 caracteres max) - une nouvelle tentative de paiement
// pour la meme commande doit en utiliser un nouveau.
async function initiatePayment({ amount, phoneNumber, externalId, orderId, orderRef }) {
  const mode = cfg.resolveMode('ORANGE_MONEY');
  const phone = toLocalPhone(phoneNumber);
  const returnUrl = `${cfg.clientUrl() || ''}/commande-confirmee/${orderId}`;

  if (mode === 'simulation') {
    return {
      referenceId: `SIM-OM-${crypto.randomUUID()}`,
      status: 'PENDING',
      simulated: true,
      paymentUrl: null,
      raw: { simulated: true, amount, phoneNumber: phone, externalId, orderRef },
    };
  }

  const s = settings();
  const token = await getAccessToken();
  const res = await http(`${s.baseUrl}/webpayment`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      merchant_key: s.merchantKey,
      currency: s.currency,
      order_id: orderRef,
      amount: Math.round(amount),
      return_url: returnUrl,
      cancel_url: returnUrl,
      notif_url: `${cfg.apiPublicUrl()}/api/payments/webhook/orange/${orderId}`,
      lang: 'fr',
      reference: `Fresh Fish ${externalId}`,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.payment_url || !data.pay_token) {
    console.error('[orangeMoney] webpayment refuse', res.status, JSON.stringify(data));
    throw new ApiError(502, "Orange Money a refusé la demande de paiement. Réessayez ou choisissez un autre mode de paiement.");
  }
  return {
    referenceId: data.pay_token,
    status: 'PENDING',
    simulated: false,
    paymentUrl: data.payment_url,
    raw: { orderRef, payToken: data.pay_token, notifToken: data.notif_token || null, amount, phoneNumber: phone, externalId },
  };
}

// Etat reel aupres d'Orange -> 'PAID' | 'FAILED' | 'PROCESSING'
async function getPaymentStatus({ orderRef, amount, payToken }) {
  if (String(payToken).startsWith('SIM-')) return { status: 'PROCESSING', raw: { simulated: true } };
  const s = settings();
  const token = await getAccessToken();
  const res = await http(`${s.baseUrl}/transactionstatus`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ order_id: orderRef, amount: Math.round(amount), pay_token: payToken }),
  });
  if (!res.ok) throw new ApiError(502, "Impossible de vérifier le paiement auprès d'Orange Money pour le moment.");
  const data = await res.json().catch(() => ({}));
  const status = data.status === 'SUCCESS' ? 'PAID' : data.status === 'FAILED' || data.status === 'EXPIRED' ? 'FAILED' : 'PROCESSING';
  return { status, raw: { status: data.status || null, txnid: data.txnid || null } };
}

module.exports = { initiatePayment, getPaymentStatus, toLocalPhone };
