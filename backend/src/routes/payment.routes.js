const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const paymentConfig = require('../config/payments');
const ctrl = require('../controllers/payment.controller');

// Anti-abus : l'initiation d'un paiement declenche une demande sur le telephone d'un tiers.
const initiateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de tentatives de paiement, réessayez dans quelques minutes.' },
});

// Etat de la configuration (environnement, cles manquantes, simulateur disponible ou non).
router.get('/config', ctrl.getConfig);

// Notifications des operateurs : declarees AVANT les routes /:orderId/... pour ne pas etre confondues avec elles.
router.post('/webhook/mtn', ctrl.mtnWebhook);
router.post('/webhook/orange/:orderId', ctrl.orangeWebhook);

router.post('/:orderId/mtn', initiateLimiter, ctrl.initiateMtn);
router.post('/:orderId/orange', initiateLimiter, ctrl.initiateOrange);
router.get('/:orderId/status', ctrl.getStatus);

// SIMULATEUR - developpement uniquement : en production la route repond 404.
router.post('/:orderId/simulate', paymentConfig.devOnly, ctrl.simulate);

// Administration : liste des paiements et constat manuel (secours si un operateur ne confirme pas seul).
router.get('/', requireAuth, requireRole('ADMIN'), ctrl.listPayments);
router.post('/:orderId/mark-paid', requireAuth, requireRole('ADMIN'), ctrl.markPaid);
router.post('/:orderId/mark-refunded', requireAuth, requireRole('ADMIN'), ctrl.markRefunded);

module.exports = router;
