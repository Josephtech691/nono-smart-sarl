const cron = require('node-cron');
const prisma = require('../config/db');
const orderService = require('../services/order.service');
const { computeNextRunAt } = require('../utils/generators');
const { notify, notifyAdmins } = require('../utils/notify');

/**
 * Parcourt les commandes recurrentes actives dont l'echeance est arrivee et
 * genere une vraie commande pour chacune (section 75 "commandes recurrentes").
 * Exportee separement de scheduleRecurringOrdersJob() pour pouvoir etre
 * appelee/testee independamment du planificateur cron.
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

// Planifie l'execution quotidienne a 6h (heure serveur). Render conserve un
// process Node persistant pour un "web service" (contrairement a des
// fonctions serverless), donc ce cron fonctionne sans infrastructure
// supplementaire.
function scheduleRecurringOrdersJob() {
  cron.schedule('0 6 * * *', () => {
    runDueRecurringOrders().catch((err) => console.error('[recurringOrders] erreur du job', err));
  });
  console.log('Tache planifiee : generation des commandes recurrentes (tous les jours a 06:00)');
}

module.exports = { scheduleRecurringOrdersJob, runDueRecurringOrders };
