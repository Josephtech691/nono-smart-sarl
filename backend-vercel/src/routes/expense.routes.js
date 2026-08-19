const router = require('express').Router();
const validate = require('../middlewares/validate.middleware');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const { expenseSchema } = require('../validators/misc.validator');
const ctrl = require('../controllers/expense.controller');

router.use(requireAuth, requireRole('ADMIN'));
router.get('/', ctrl.listExpenses);
router.post('/', validate(expenseSchema), ctrl.createExpense);
router.delete('/:id', ctrl.deleteExpense);
router.get('/profit-estimate', ctrl.profitEstimate);

module.exports = router;
