// Integration SMS - structuree pour un fournisseur comme Africa's Talking ou
// Twilio (tres utilises pour le SMS au Cameroun). Meme principe que
// integrations/mtnMomo.js : ce fichier isole le point d'integration reel a
// brancher avec les identifiants SMS_* du .env. Tant que ce n'est pas fait,
// sendSms() simule un envoi reussi et journalise le message (pratique pour
// verifier le contenu pendant les tests).
//
// Forme reelle attendue avec Africa's Talking (a decommenter/adapter) :
//
//   const AfricasTalking = require('africastalking')({
//     apiKey: process.env.SMS_API_KEY,
//     username: process.env.SMS_USERNAME,
//   });
//   async function sendSms(to, message) {
//     const result = await AfricasTalking.SMS.send({ to: [to], message, from: process.env.SMS_SENDER_ID });
//     return { status: 'SENT', raw: result };
//   }

async function sendSms(to, message) {
  if (!to) return { status: 'SKIPPED', reason: 'no phone number' };
  if (!process.env.SMS_API_KEY) {
    console.log(`[sms:simule] -> ${to} : ${message}`);
    return { status: 'SIMULATED' };
  }
  // TODO brancher le vrai fournisseur SMS ici.
  console.log(`[sms] -> ${to} : ${message}`);
  return { status: 'SENT' };
}

module.exports = { sendSms };
