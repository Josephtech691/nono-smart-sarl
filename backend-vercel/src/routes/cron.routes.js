const router = require('express').Router();
const ctrl = require('../controllers/cron.controller');

// Pas de middleware requireAuth ici : la securite est assuree par le
// controleur via le header Authorization envoye automatiquement par Vercel
// Cron (voir cron.controller.js). Vercel invoque toujours ce chemin en GET.
router.get('/recurring-orders', ctrl.recurringOrders);

module.exports = router;
