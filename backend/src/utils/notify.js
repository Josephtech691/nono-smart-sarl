const prisma = require('../config/db');
const { sendSms } = require('../integrations/sms');
const { sendWhatsAppMessage } = require('../integrations/whatsapp');
const { sendPush } = require('../services/push.service');

// Cree une notification en base (centre de notifications in-app), et
// declenche en plus un SMS et/ou un message WhatsApp si demande (section 40,
// 41, 75). Best-effort partout : une erreur ici ne doit jamais faire echouer
// l'action principale (ex: creation de commande), donc on avale silencieusement
// les erreurs apres les avoir loguees.
async function notify({ userId = null, audience, title, message, link = null, phone = null, sms = false, whatsapp = false }) {
  // Seuls un destinataire identifie (userId) ou l'administration (partagee) ont un centre de
  // notifications. Un client sans compte (commande en tant qu'invite) n'en a pas : une ligne sans
  // destinataire serait lisible par tous les clients connectes. Il est prevenu par SMS / WhatsApp.
  if (userId || audience === 'ADMIN') {
    try {
      await prisma.notification.create({
        data: { userId, audience, title, message, link },
      });
    } catch (err) {
      console.error('[notify] echec de creation de notification', err.message);
    }

    // Push vers le(s) telephone(s) : le destinataire, ou tous les administrateurs actifs.
    try {
      const userIds = userId
        ? [userId]
        : (await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } })).map((u) => u.id);
      await sendPush({ userIds, title, message, link });
    } catch (err) {
      console.error('[notify:push]', err.message);
    }
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

// Alerte l'administration quand une commande fait passer un produit sous son seuil d'alerte, et
// seulement a ce moment-la (pas une notification par commande tant que le stock reste bas).
// `items` : lignes de la commande { productId, quantity } (la reservation est deja enregistree).
async function notifyLowStock(items) {
  try {
    const products = await prisma.product.findMany({ where: { id: { in: items.map((i) => i.productId) } } });
    const variantIds = items.map((i) => i.variantId).filter(Boolean);
    const variants = variantIds.length ? await prisma.productVariant.findMany({ where: { id: { in: variantIds } } }) : [];
    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product || !(product.alertThreshold > 0)) continue;
      // Produit a variantes : le stock suivi est celui de la variante commandee.
      const variant = item.variantId ? variants.find((v) => v.id === item.variantId) : null;
      if (item.variantId && !variant) continue;
      const source = variant || product;
      const available = source.stockQuantity - source.reservedQuantity;
      if (available <= product.alertThreshold && available + item.quantity > product.alertThreshold) {
        await notifyAdmins({
          title: 'Stock faible',
          message: `${product.name}${variant ? ` (${variant.label})` : ''} : stock restant ${available} (seuil ${product.alertThreshold})`,
          link: '/admin/produits',
        });
      }
    }
  } catch (err) {
    console.error('[notify] alerte de stock', err.message);
  }
}

module.exports = { notify, notifyAdmins, notifyLowStock };
