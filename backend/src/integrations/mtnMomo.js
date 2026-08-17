// Integration MTN Mobile Money - Collections API.
// Portail developpeur : https://momodeveloper.mtn.com
//
// Ce fichier est un point d'integration clairement isole : en Phase 2, brancher
// ici les vrais appels (RequestToPay puis polling/callback du statut) avec les
// identifiants MTN_MOMO_* definis dans le .env. Tant que ce n'est pas fait,
// requestToPay() simule une demande initiee avec succes (statut PROCESSING),
// pour permettre de tester tout le tunnel de commande de bout en bout.
//
// Forme reelle attendue (a decommenter/adapter une fois les identifiants
// obtenus) :
//
//   const axios = require('axios');
//   async function requestToPay({ amount, phoneNumber, externalId }) {
//     const token = await getAccessToken();
//     const referenceId = crypto.randomUUID();
//     await axios.post(`${process.env.MTN_MOMO_API_URL}/collection/v1_0/requesttopay`, {
//       amount: String(amount),
//       currency: 'XAF',
//       externalId,
//       payer: { partyIdType: 'MSISDN', partyId: phoneNumber },
//       payerMessage: 'Commande NONO SMART',
//       payeeNote: externalId,
//     }, {
//       headers: {
//         Authorization: `Bearer ${token}`,
//         'X-Reference-Id': referenceId,
//         'X-Target-Environment': process.env.MTN_MOMO_TARGET_ENVIRONMENT,
//         'Ocp-Apim-Subscription-Key': process.env.MTN_MOMO_SUBSCRIPTION_KEY,
//       },
//     });
//     return { referenceId, status: 'PENDING' };
//   }

async function requestToPay({ amount, phoneNumber, externalId }) {
  if (!process.env.MTN_MOMO_SUBSCRIPTION_KEY) {
    console.warn('[mtnMomo] Cles API absentes - reponse simulee (mode developpement)');
  }
  return {
    referenceId: `MTN-SIM-${Date.now()}`,
    status: 'PENDING',
    raw: { note: 'Reponse simulee - brancher la veritable API MTN MoMo ici', amount, phoneNumber, externalId },
  };
}

module.exports = { requestToPay };
