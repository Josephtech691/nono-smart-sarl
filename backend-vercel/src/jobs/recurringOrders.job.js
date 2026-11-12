const prisma = require('../config/db');
const orderService = require('../services/order.service');
const { computeNextRunAt } = require('../utils/generators');
const { notify, notifyAdmins } = require('../utils/notify');
const { isPendingPhone } = require('../utils/phone');

// NOTE (variante Vercel) : sur une plateforme serverless il n'y a pas de
// process persistant pour porter un `node-cron`. Cette fonction est donc
// declenchee par un Vercel Cron Job qui appelle GET /api/cron/recurring-orders
// une fois par jour (voir vercel.json + src/controllers/cron.controller.js).
// La variante Render, elle, peut se permettre un vrai scheduler en memoire
// puisque le process y reste actif en continu.

/**
 * Parcourt les commandes recurrentes actives dont l'echeance est arrivee et
 * genere une vraie commande pour chacune (section 75 "commandes recurrentes").
 */
async function runDueRecurringOrders() {
  const due = await prisma.recurringOrder.findMany({
    where: { isActive: true, nextRunAt: { lte: new Date() } },
    include: { customer: { include: { user: true } } },
  });

  for (const recurring of due) {
    try {
      const orderId = await orderService.createOrder({
        customerId: recurring.customerId,
        addressId: recurring.addressId,
        deliveryZoneId: recurring.deliveryZoneId,
        paymentMethod: recurring.paymentMethod,
        // Mobile Money : le numero du compte sert de numero de paiement (le client valide ensuite depuis sa commande).
        paymentPhoneNumber:
          recurring.paymentMethod !== 'CASH' && !isPendingPhone(recurring.customer.user.phone) ? recurring.customer.user.phone : null,
        items: recurring.items,
        notes: `Commande récurrente${recurring.label ? ` : ${recurring.label}` : ''}`,
        originRecurringOrderId: recurring.id,
      });

      await prisma.recurringOrder.update({
        where: { id: recurring.id },
        data: { lastRunAt: new Date(), nextRunAt: computeNextRunAt(recurring.frequency) },
      });

      const order = await prisma.order.findUnique({ where: { id: orderId } });
      await notify({
        userId: recurring.customer.userId,
        audience: 'CUSTOMER',
        title: 'Commande récurrente générée',
        message: `Votre commande habituelle${recurring.label ? ` "${recurring.label}"` : ''} a été passée automatiquement (${order.orderNumber}).`,
        link: `/compte/commandes/${orderId}`,
        phone: recurring.customer.user.phone,
        sms: true,
      });
    } catch (err) {
      // Cas frequent : stock insuffisant au moment de l'echeance. On previent
      // le client et l'admin plutot que de faire echouer silencieusement, et
      // on reporte l'echeance pour ne pas boucler indefiniment sur l'erreur.
      console.error('[recurringOrders] echec de generation pour', recurring.id, err.message);
      await prisma.recurringOrder.update({
        where: { id: recurring.id },
        data: { nextRunAt: computeNextRunAt(recurring.frequency) },
      }).catch(() => {});
      await notify({
        userId: recurring.customer.userId,
        audience: 'CUSTOMER',
        title: 'Commande récurrente en échec',
        message: `Votre commande habituelle n'a pas pu être générée automatiquement (${err.message}). Vous pouvez la repasser manuellement.`,
        link: '/compte/commandes-recurrentes',
        phone: recurring.customer.user.phone,
        sms: true,
      });
      await notifyAdmins({ title: 'Commande récurrente en échec', message: `${recurring.id} : ${err.message}` });
    }
  }

  return due.length;
}

module.exports = { runDueRecurringOrders };
