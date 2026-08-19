const router = require('express').Router();
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/payment.controller');

router.post('/:orderId/mtn', ctrl.initiateMtn);
router.post('/:orderId/orange', ctrl.initiateOrange);
router.get('/:orderId/status', ctrl.getStatus);
router.post('/:orderId/simulate', requireAuth, requireRole('ADMIN'), ctrl.simulateSuccess);

module.exports = router;
