const router = require('express').Router();
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/favorite.controller');

router.use(requireAuth, requireRole('CUSTOMER'));
router.get('/', ctrl.listMyFavorites);
router.post('/', ctrl.addFavorite);
router.delete('/:productId', ctrl.removeFavorite);

module.exports = router;
