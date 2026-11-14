// Notifications push (Firebase Cloud Messaging) vers les applications Android.
//
// Configuration : variable d'environnement FIREBASE_SERVICE_ACCOUNT = contenu JSON (une seule ligne) de la
// « cle de compte de service » Firebase (Parametres du projet > Comptes de service > Generer une cle privee).
// Sans cette variable, ou sans le paquet firebase-admin, les push sont simplement ignorees : les notifications
// restent disponibles dans l'application (cloche) et par SMS / WhatsApp.
const prisma = require('../config/db');

let messaging = null;
let initTried = false;

function getMessaging() {
  if (initTried) return messaging;
  initTried = true;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    // eslint-disable-next-line global-require
    const admin = require('firebase-admin');
    const credential = admin.credential.cert(JSON.parse(raw));
    const app = admin.apps.length ? admin.app() : admin.initializeApp({ credential });
    messaging = admin.messaging(app);
  } catch (err) {
    console.error('[push] initialisation Firebase impossible :', err.message);
    messaging = null;
  }
  return messaging;
}

// Liens internes uniquement : l'application n'ouvre jamais une adresse externe depuis une notification.
const safeLink = (link) => (typeof link === 'string' && link.startsWith('/') && !link.startsWith('//') ? link : '');

/**
 * Envoie une notification push a tous les telephones d'une liste d'utilisateurs.
 * Canal Android « orders » (importance maximale) : la notification s'affiche en banniere en haut de l'ecran
 * quelques secondes, puis reste dans le volet de notifications du telephone.
 */
async function sendPush({ userIds, title, message, link }) {
  const fcm = getMessaging();
  if (!fcm || !userIds?.length) return;

  try {
    const devices = await prisma.deviceToken.findMany({ where: { userId: { in: userIds } }, select: { token: true } });
    const tokens = [...new Set(devices.map((d) => d.token))];
    if (tokens.length === 0) return;

    // 500 jetons maximum par envoi groupe.
    for (let i = 0; i < tokens.length; i += 500) {
      const batch = tokens.slice(i, i + 500);
      const res = await fcm.sendEachForMulticast({
        tokens: batch,
        notification: { title, body: message },
        data: { link: safeLink(link), title, body: message },
        android: {
          priority: 'high',
          notification: { channelId: 'orders', sound: 'default', defaultVibrateTimings: true, visibility: 'public' },
        },
      });

      // Retire les telephones qui ne sont plus valides (application desinstallee...).
      const dead = [];
      res.responses.forEach((r, idx) => {
        const code = r.error?.code || '';
        if (!r.success && (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token') || code.includes('invalid-argument'))) {
          dead.push(batch[idx]);
        }
      });
      if (dead.length) await prisma.deviceToken.deleteMany({ where: { token: { in: dead } } });
    }
  } catch (err) {
    console.error('[push] envoi impossible :', err.message);
  }
}

module.exports = { sendPush };
