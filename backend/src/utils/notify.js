const prisma = require('../config/db');
const { sendSms } = require('../integrations/sms');
const { sendWhatsAppMessage } = require('../integrations/whatsapp');

// Cree une notification en base (centre de notifications in-app), et
// declenche en plus un SMS et/ou un message WhatsApp si demande (section 40,
// 41, 75). Best-effort partout : une erreur ici ne doit jamais faire echouer
// l'action principale (ex: creation de commande), donc on avale silencieusement
// les erreurs apres les avoir loguees.
async function notify({ userId = null, audience, title, message, link = null, phone = null, sms = false, whatsapp = false }) {
  try {
    await prisma.notification.create({
      data: { userId, audience, title, message, link },
    });
  } catch (err) {
    console.error('[notify] echec de creation de notification', err.message);
  }

  if (sms && phone) {
    await sendSms(phone, message).catch((err) => console.error('[notify:sms]', err.message));
  }
  if (whatsapp && phone) {
    await sendWhatsAppMessage(phone, message).catch((err) => console.error('[notify:whatsapp]', err.message));
  }
}

async function notifyAdmins({ title, message, link = null }) {
  return notify({ audience: 'ADMIN', title, message, link });
}

module.exports = { notify, notifyAdmins };
