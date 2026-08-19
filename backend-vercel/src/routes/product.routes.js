const router = require('express').Router();
const validate = require('../middlewares/validate.middleware');
const { requireAuth, requireRole, optionalAuth } = require('../middlewares/auth.middleware');
const { productSchema, productUpdateSchema } = require('../validators/catalog.validator');
const ctrl = require('../controllers/product.controller');

router.get('/', optionalAuth, ctrl.listProducts);
router.get('/:idOrSlug', ctrl.getProduct);
router.get('/:id/recommendations', ctrl.getRecommendations);
router.post('/', requireAuth, requireRole('ADMIN'), validate(productSchema), ctrl.createProduct);
router.patch('/:id', requireAuth, requireRole('ADMIN'), validate(productUpdateSchema), ctrl.updateProduct);
router.delete('/:id', requireAuth, requireRole('ADMIN'), ctrl.deleteProduct);
router.patch('/:id/stock', requireAuth, requireRole('ADMIN'), ctrl.adjustStock);

module.exports = router;
