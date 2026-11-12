const router = require('express').Router();
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { customerPriceSchema } = require('../validators/catalog.validator');
const ctrl = require('../controllers/customer.controller');

router.get('/me/prices', requireAuth, requireRole('CUSTOMER'), ctrl.myPrices);
router.get('/me/referral', requireAuth, requireRole('CUSTOMER'), ctrl.myReferral);
router.patch('/me/professional-request', requireAuth, requireRole('CUSTOMER'), ctrl.requestProfessionalStatus);

router.get('/', requireAuth, requireRole('ADMIN'), ctrl.listCustomers);
router.get('/:id', requireAuth, requireRole('ADMIN'), ctrl.getCustomer);
router.patch('/:id/professional-status', requireAuth, requireRole('ADMIN'), ctrl.updateProfessionalStatus);
router.get('/:id/prices', requireAuth, requireRole('ADMIN'), ctrl.listCustomerPrices);
router.put('/:id/prices', requireAuth, requireRole('ADMIN'), validate(customerPriceSchema), ctrl.setCustomerPrice);
router.delete('/:id/prices/:priceId', requireAuth, requireRole('ADMIN'), ctrl.deleteCustomerPrice);
router.post('/:id/reset-password', requireAuth, requireRole('ADMIN'), ctrl.resetCustomerPassword);

module.exports = router;
