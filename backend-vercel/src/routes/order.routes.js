const router = require('express').Router();
const validate = require('../middlewares/validate.middleware');
const { requireAuth, requireRole, optionalAuth } = require('../middlewares/auth.middleware');
const { createOrderSchema, updateStatusSchema } = require('../validators/order.validator');
const { reviewSchema } = require('../validators/misc.validator');
const ctrl = require('../controllers/order.controller');
const reviewCtrl = require('../controllers/review.controller');

// La creation de commande accepte les invites (optionalAuth) et les clients connectes
router.post('/', optionalAuth, validate(createOrderSchema), ctrl.createOrder);
// Le paiement en especes est-il propose a ce client ? (compte + plus de 2 commandes payees en Mobile Money)
router.get('/cash-eligibility', optionalAuth, ctrl.cashEligibility);
router.get('/track/:orderNumber', ctrl.trackOrder);
router.get('/track/:orderNumber/invoice.pdf', ctrl.downloadInvoiceByTracking);

// Consultation reservee aux clients (leurs commandes) et a l'administration. Un livreur passe
// par /drivers/me/* : sinon il pourrait lire toutes les commandes, leurs clients et les codes
// de confirmation de livraison.
router.get('/', requireAuth, requireRole('ADMIN', 'CUSTOMER'), ctrl.listOrders);
// Avant /:id, sinon « export.csv » serait pris pour un identifiant de commande.
router.get('/export.csv', requireAuth, requireRole('ADMIN'), ctrl.exportOrders);
router.get('/:id', requireAuth, requireRole('ADMIN', 'CUSTOMER'), ctrl.getOrder);
router.get('/:id/invoice.pdf', requireAuth, requireRole('ADMIN', 'CUSTOMER'), ctrl.downloadInvoice);
router.patch('/:id/status', requireAuth, requireRole('ADMIN'), validate(updateStatusSchema), ctrl.updateStatus);
router.post('/:id/assign-driver', requireAuth, requireRole('ADMIN'), ctrl.assignDriver);
router.post('/:id/auto-assign-driver', requireAuth, requireRole('ADMIN'), ctrl.autoAssignDriver);
router.post('/:id/cancel', requireAuth, requireRole('ADMIN', 'CUSTOMER'), ctrl.cancelOrder);
router.post('/:id/review', requireAuth, requireRole('CUSTOMER'), validate(reviewSchema), reviewCtrl.createReview);

module.exports = router;
