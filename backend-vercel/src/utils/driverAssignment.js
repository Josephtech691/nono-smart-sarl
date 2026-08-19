const prisma = require('../config/db');

const ACTIVE_DELIVERY_STATUSES = ['ASSIGNED', 'PICKED_UP', 'ON_ROUTE'];

/**
 * Choisit le meilleur livreur disponible pour une nouvelle livraison :
 * parmi les livreurs AVAILABLE, celui qui a le moins de livraisons actives en
 * cours (repartition simple de la charge). Retourne null si aucun livreur
 * disponible (l'admin devra assigner manuellement).
 *
 * Section 76 "Livraison avancee" : Commande -> Recherche livreurs disponibles
 * -> Calcul distance -> Selection livreur -> Notification. Le calcul de
 * distance reel necessiterait un service de routing externe (cle API) ; en
 * attendant, la charge de travail est un proxy raisonnable et fonctionne
 * sans dependance externe.
 */
async function findBestDriver(client = prisma) {
  const drivers = await client.driverProfile.findMany({
    where: { status: 'AVAILABLE', user: { isActive: true } },
    include: {
      _count: { select: { deliveries: { where: { status: { in: ACTIVE_DELIVERY_STATUSES } } } } },
    },
  });
  if (!drivers.length) return null;

  drivers.sort((a, b) => a._count.deliveries - b._count.deliveries);
  return drivers[0];
}

/**
 * Assigne effectivement une commande a un livreur (utilise par l'assignation
 * manuelle admin ET l'assignation automatique). `tx` est le client Prisma ou
 * une transaction en cours.
 */
async function performAssignment(tx, orderId, driverId) {
  await tx.delivery.update({ where: { orderId }, data: { driverId, status: 'ASSIGNED', assignedAt: new Date() } });
  await tx.order.update({ where: { id: orderId }, data: { status: 'ASSIGNED' } });
  await tx.orderStatusHistory.create({ data: { orderId, status: 'ASSIGNED', note: 'Livreur assigne' } });
}

module.exports = { findBestDriver, performAssignment };
