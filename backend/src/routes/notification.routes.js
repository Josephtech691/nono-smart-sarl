const router = require('express').Router();
const { requireAuth } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/notification.controller');

router.use(requireAuth);
router.get('/', ctrl.listMyNotifications);
router.patch('/:id/read', ctrl.markRead);
router.post('/read-all', ctrl.markAllRead);

module.exports = router;
