const router = require('express').Router();
const validate = require('../middlewares/validate.middleware');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const { categorySchema } = require('../validators/catalog.validator');
const ctrl = require('../controllers/category.controller');

router.get('/', ctrl.listCategories);
router.post('/', requireAuth, requireRole('ADMIN'), validate(categorySchema), ctrl.createCategory);
router.patch('/:id', requireAuth, requireRole('ADMIN'), ctrl.updateCategory);
router.delete('/:id', requireAuth, requireRole('ADMIN'), ctrl.deleteCategory);

module.exports = router;
