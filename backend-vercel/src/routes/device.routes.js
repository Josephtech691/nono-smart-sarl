const router = require('express').Router();
const { requireAuth } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/device.controller');

router.use(requireAuth);
router.post('/', ctrl.registerDevice);
router.delete('/', ctrl.unregisterDevice);

module.exports = router;
