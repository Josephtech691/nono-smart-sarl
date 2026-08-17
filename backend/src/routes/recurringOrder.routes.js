const router = require('express').Router();
const validate = require('../middlewares/validate.middleware');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const { recurringOrderSchema, recurringOrderUpdateSchema } = require('../validators/recurringOrder.validator');
const ctrl = require('../controllers/recurringOrder.controller');

router.use(requireAuth, requireRole('CUSTOMER'));
router.get('/', ctrl.listMine);
router.post('/', validate(recurringOrderSchema), ctrl.create);
router.patch('/:id', validate(recurringOrderUpdateSchema), ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
