const router = require('express').Router();
const validate = require('../middlewares/validate.middleware');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const { couponSchema } = require('../validators/misc.validator');
const ctrl = require('../controllers/coupon.controller');

router.post('/validate', ctrl.validateCoupon);
router.get('/', requireAuth, requireRole('ADMIN'), ctrl.listCoupons);
router.post('/', requireAuth, requireRole('ADMIN'), validate(couponSchema), ctrl.createCoupon);
router.patch('/:id', requireAuth, requireRole('ADMIN'), ctrl.updateCoupon);

module.exports = router;
