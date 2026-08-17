const router = require('express').Router();
const validate = require('../middlewares/validate.middleware');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const { deliveryZoneSchema } = require('../validators/misc.validator');
const ctrl = require('../controllers/deliveryZone.controller');

router.get('/', ctrl.listZones);
router.post('/', requireAuth, requireRole('ADMIN'), validate(deliveryZoneSchema), ctrl.createZone);
router.patch('/:id', requireAuth, requireRole('ADMIN'), ctrl.updateZone);
router.delete('/:id', requireAuth, requireRole('ADMIN'), ctrl.deleteZone);

module.exports = router;
