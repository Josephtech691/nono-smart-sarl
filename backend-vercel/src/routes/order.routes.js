const router = require('express').Router();
const validate = require('../middlewares/validate.middleware');
const { requireAuth, requireRole, optionalAuth } = require('../middlewares/auth.middleware');
const { createOrderSchema, updateStatusSchema } = require('../validators/order.validator');
const { reviewSchema } = require('../validators/misc.validator');
const ctrl = require('../controllers/order.controller');
const reviewCtrl = require('../controllers/review.controller');

// La creation de commande accepte les invites (optionalAuth) et les clients connectes
router.post('/', optionalAuth, validate(createOrderSchema), ctrl.createOrder);
router.get('/track/:orderNumber', ctrl.trackOrder);
router.get('/track/:orderNumber/invoice.pdf', ctrl.downloadInvoiceByTracking);

router.get('/', requireAuth, ctrl.listOrders);
router.get('/:id', requireAuth, ctrl.getOrder);
router.get('/:id/invoice.pdf', requireAuth, ctrl.downloadInvoice);
router.patch('/:id/status', requireAuth, requireRole('ADMIN'), validate(updateStatusSchema), ctrl.updateStatus);
router.post('/:id/assign-driver', requireAuth, requireRole('ADMIN'), ctrl.assignDriver);
router.post('/:id/auto-assign-driver', requireAuth, requireRole('ADMIN'), ctrl.autoAssignDriver);
router.post('/:id/cancel', requireAuth, requireRole('ADMIN', 'CUSTOMER'), ctrl.cancelOrder);
router.post('/:id/review', requireAuth, requireRole('CUSTOMER'), validate(reviewSchema), reviewCtrl.createReview);

module.exports = router;
