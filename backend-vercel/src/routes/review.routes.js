const router = require('express').Router();
const { requireAuth, requireRole, optionalAuth } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/review.controller');

router.get('/mine', requireAuth, requireRole('CUSTOMER'), ctrl.myReviews);
router.get('/', optionalAuth, ctrl.listReviews);
router.patch('/:id', requireAuth, requireRole('ADMIN'), ctrl.moderateReview);

module.exports = router;
