const router = require('express').Router();
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/customer.controller');

router.get('/me/referral', requireAuth, requireRole('CUSTOMER'), ctrl.myReferral);
router.patch('/me/professional-request', requireAuth, requireRole('CUSTOMER'), ctrl.requestProfessionalStatus);

router.get('/', requireAuth, requireRole('ADMIN'), ctrl.listCustomers);
router.get('/:id', requireAuth, requireRole('ADMIN'), ctrl.getCustomer);
router.patch('/:id/professional-status', requireAuth, requireRole('ADMIN'), ctrl.updateProfessionalStatus);

module.exports = router;
