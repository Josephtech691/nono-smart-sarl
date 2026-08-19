// Integration WhatsApp - structuree pour la WhatsApp Business Cloud API
// (Meta). Necessite un compte WhatsApp Business Platform + un numero valide
// aupres de Meta. Meme principe honnete que les autres integrations : point
// d'integration complet, appel reel a brancher avec WHATSAPP_ACCESS_TOKEN et
// WHATSAPP_PHONE_NUMBER_ID.
//
// Forme reelle attendue (a decommenter/adapter) :
//
//   const axios = require('axios');
//   async function sendWhatsAppMessage(to, message) {
//     const url = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
//     const { data } = await axios.post(url, {
//       messaging_product: 'whatsapp',
//       to,
//       type: 'text',
//       text: { body: message },
//     }, { headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` } });
//     return { status: 'SENT', raw: data };
//   }

async function sendWhatsAppMessage(to, message) {
  if (!to) return { status: 'SKIPPED', reason: 'no phone number' };
  if (!process.env.WHATSAPP_ACCESS_TOKEN) {
    console.log(`[whatsapp:simule] -> ${to} : ${message}`);
    return { status: 'SIMULATED' };
  }
  // TODO brancher le vrai appel Graph API ici.
  console.log(`[whatsapp] -> ${to} : ${message}`);
  return { status: 'SENT' };
}

module.exports = { sendWhatsAppMessage };
