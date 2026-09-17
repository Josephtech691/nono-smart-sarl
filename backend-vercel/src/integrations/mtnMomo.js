/**
 * Intégration MTN Mobile Money - Collections API
 * NONO SMART SARL
 *
 * Sandbox MTN MoMo
 *
 * Variables attendues :
 *
 * MTN_MOMO_API_URL=https://sandbox.momodeveloper.mtn.com
 * MTN_MOMO_API_KEY=<API USER / X-Reference-Id>
 * MTN_MOMO_API_SECRET=<API KEY générée par MTN>
 * MTN_MOMO_SUBSCRIPTION_KEY=<SUBSCRIPTION KEY>
 * MTN_MOMO_TARGET_ENVIRONMENT=sandbox
 */

const crypto = require('crypto');

const API_URL =
  process.env.MTN_MOMO_API_URL ||
  'https://sandbox.momodeveloper.mtn.com';

const TARGET_ENVIRONMENT =
  process.env.MTN_MOMO_TARGET_ENVIRONMENT || 'sandbox';

/**
 * Vérifie que les identifiants nécessaires sont présents.
 */
function validateConfig() {
  const required = [
    'MTN_MOMO_API_KEY',
    'MTN_MOMO_API_SECRET',
    'MTN_MOMO_SUBSCRIPTION_KEY',
  ];

  const missing = required.filter(
    (name) => !process.env[name]
  );

  if (missing.length > 0) {
    throw new Error(
      `Configuration MTN MoMo incomplète. Variables manquantes : ${missing.join(', ')}`
    );
  }
}

/**
 * Génère le header Authorization Basic utilisé
 * pour obtenir le token OAuth MTN.
 *
 * IMPORTANT :
 * MTN_MOMO_API_KEY    = API User / X-Reference-Id
 * MTN_MOMO_API_SECRET = API Key générée par MTN
 */
function getBasicAuthorization() {
  validateConfig();

  const credentials = `${process.env.MTN_MOMO_API_KEY}:${process.env.MTN_MOMO_API_SECRET}`;

  return `Basic ${Buffer.from(credentials).toString('base64')}`;
}

/**
 * Obtient un access token MTN MoMo.
 */
async function getAccessToken() {
  const response = await fetch(
    `${API_URL}/collection/token/`,
    {
      method: 'POST',
      headers: {
        Authorization: getBasicAuthorization(),
        'Ocp-Apim-Subscription-Key':
          process.env.MTN_MOMO_SUBSCRIPTION_KEY,
      },
    }
  );

  const text = await response.text();

  let data;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const error = new Error(
      `MTN OAuth error (${response.status})`
    );

    error.status = response.status;
    error.response = data;

    throw error;
  }

  if (!data.access_token) {
    throw new Error(
      'MTN OAuth : aucun access_token retourné par MTN'
    );
  }

  return data.access_token;
}

/**
 * Normalise un numéro de téléphone camerounais.
 *
 * Exemples :
 *  - 677123456  -> 677123456
 *  - 237677123456 -> 677123456
 *  - +237677123456 -> 677123456
 *
 * MTN Collections attend généralement le MSISDN
 * sans le préfixe international dans le contexte Sandbox.
 */
function normalizePhoneNumber(phoneNumber) {
  if (!phoneNumber) {
    throw new Error('Numéro de téléphone MTN manquant');
  }

  let phone = String(phoneNumber).trim();

  phone = phone.replace(/\s+/g, '');

  if (phone.startsWith('+237')) {
    phone = phone.substring(4);
  } else if (phone.startsWith('237')) {
    phone = phone.substring(3);
  }

  if (!/^6\d{8}$/.test(phone)) {
    throw new Error(
      'Numéro MTN invalide. Utilise un numéro camerounais au format 6XXXXXXXX.'
    );
  }

  return phone;
}

/**
 * Lance une demande de paiement MTN Mobile Money.
 *
 * @param {Object} params
 * @param {number|string} params.amount
 * @param {string} params.phoneNumber
 * @param {string} params.externalId
 *
 * @returns {Object}
 */
async function requestToPay({
  amount,
  phoneNumber,
  externalId,
}) {
  validateConfig();

  if (!amount || Number(amount) <= 0) {
    throw new Error('Montant MTN invalide');
  }

  if (!externalId) {
    throw new Error('externalId MTN manquant');
  }

  const normalizedPhone = normalizePhoneNumber(phoneNumber);

  const accessToken = await getAccessToken();

  /**
   * X-Reference-Id identifie la demande de paiement.
   *
   * On génère un UUID différent pour chaque paiement.
   */
  const referenceId = crypto.randomUUID();

  const payload = {
    amount: String(Math.round(Number(amount))),
    currency: 'XAF',
    externalId: String(externalId),
    payer: {
      partyIdType: 'MSISDN',
      partyId: normalizedPhone,
    },
    payerMessage: 'Commande NONO SMART',
    payeeNote: String(externalId),
  };

  const response = await fetch(
    `${API_URL}/collection/v1_0/requesttopay`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Reference-Id': referenceId,
        'X-Target-Environment': TARGET_ENVIRONMENT,
        'Ocp-Apim-Subscription-Key':
          process.env.MTN_MOMO_SUBSCRIPTION_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text || null;
  }

  /**
   * MTN retourne normalement HTTP 202 Accepted
   * lorsqu'une demande RequestToPay est correctement créée.
   */
  if (!response.ok) {
    const error = new Error(
      `MTN RequestToPay error (${response.status})`
    );

    error.status = response.status;
    error.response = data;
    error.referenceId = referenceId;

    throw error;
  }

  return {
    referenceId,
    status: 'PENDING',
    raw: {
      provider: 'mtn_momo',
      httpStatus: response.status,
      referenceId,
      externalId,
      amount: Number(amount),
      phoneNumber: normalizedPhone,
      response: data,
    },
  };
}

/**
 * Consulte le statut d'une demande RequestToPay.
 *
 * Statuts MTN possibles notamment :
 *  - PENDING
 *  - SUCCESSFUL
 *  - FAILED
 */
async function getRequestToPayStatus(referenceId) {
  if (!referenceId) {
    throw new Error(
      'ReferenceId MTN manquant pour la vérification du statut'
    );
  }

  const accessToken = await getAccessToken();

  const response = await fetch(
    `${API_URL}/collection/v1_0/requesttopay/${encodeURIComponent(
      referenceId
    )}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Target-Environment': TARGET_ENVIRONMENT,
        'Ocp-Apim-Subscription-Key':
          process.env.MTN_MOMO_SUBSCRIPTION_KEY,
      },
    }
  );

  const text = await response.text();

  let data;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const error = new Error(
      `MTN status error (${response.status})`
    );

    error.status = response.status;
    error.response = data;
    error.referenceId = referenceId;

    throw error;
  }

  return {
    referenceId,
    status: data.status || 'PENDING',
    financialTransactionId:
      data.financialTransactionId || null,
    raw: data,
  };
}

module.exports = {
  getAccessToken,
  requestToPay,
  getRequestToPayStatus,
  normalizePhoneNumber,
};
