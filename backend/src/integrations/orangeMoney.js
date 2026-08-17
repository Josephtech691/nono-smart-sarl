// Integration Orange Money - Orange Money Web Payment API.
// Portail developpeur : https://developer.orange.com
//
// Meme principe que integrations/mtnMomo.js : ce fichier isole le point
// d'integration reel a brancher en Phase 2 avec les identifiants
// ORANGE_MONEY_* definis dans le .env. Pour l'instant, initiatePayment()
// simule une demande de paiement initiee avec succes.

async function initiatePayment({ amount, phoneNumber, externalId }) {
  if (!process.env.ORANGE_MONEY_API_KEY) {
    console.warn('[orangeMoney] Cles API absentes - reponse simulee (mode developpement)');
  }
  return {
    referenceId: `ORANGE-SIM-${Date.now()}`,
    status: 'PENDING',
    raw: { note: 'Reponse simulee - brancher la veritable API Orange Money ici', amount, phoneNumber, externalId },
  };
}

module.exports = { initiatePayment };
