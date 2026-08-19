const router = require('express').Router();
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/address.controller');

router.use(requireAuth, requireRole('CUSTOMER'));
router.get('/', ctrl.listMyAddresses);
router.post('/', ctrl.createAddress);
router.patch('/:id', ctrl.updateAddress);
router.delete('/:id', ctrl.deleteAddress);

module.exports = router;
