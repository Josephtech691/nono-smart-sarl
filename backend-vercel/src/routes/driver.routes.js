const router = require('express').Router();
const validate = require('../middlewares/validate.middleware');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const { driverCreateSchema } = require('../validators/misc.validator');
const ctrl = require('../controllers/driver.controller');

// --- Administration des livreurs ---
router.get('/', requireAuth, requireRole('ADMIN'), ctrl.listDrivers);
router.post('/', requireAuth, requireRole('ADMIN'), validate(driverCreateSchema), ctrl.createDriver);
router.patch('/:id', requireAuth, requireRole('ADMIN'), ctrl.updateDriver);

// --- Espace livreur (self-service) ---
router.get('/me/deliveries', requireAuth, requireRole('DRIVER'), ctrl.myDeliveries);
router.get('/me/deliveries/:orderId', requireAuth, requireRole('DRIVER'), ctrl.getDelivery);
router.patch('/me/deliveries/:orderId/status', requireAuth, requireRole('DRIVER'), ctrl.updateDeliveryStatus);
router.post('/me/deliveries/:orderId/confirm', requireAuth, requireRole('DRIVER'), ctrl.confirmDelivery);
router.patch('/me/status', requireAuth, requireRole('DRIVER'), ctrl.updateMyStatus);
router.patch('/me/location', requireAuth, requireRole('DRIVER'), ctrl.updateMyLocation);

module.exports = router;
