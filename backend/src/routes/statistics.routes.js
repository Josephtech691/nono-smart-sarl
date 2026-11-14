const router = require('express').Router();
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/statistics.controller');

router.use(requireAuth, requireRole('ADMIN'));
router.get('/dashboard', ctrl.dashboard);
router.get('/sales', ctrl.sales);
router.get('/products', ctrl.products);
router.get('/zones', ctrl.zones);
router.get('/profit-by-product', ctrl.profitByProduct);
router.get('/top-customers', ctrl.topCustomers);
router.get('/driver-performance', ctrl.driverPerformance);
router.get('/stock-forecast', ctrl.stockForecast);
router.get('/anomalies', ctrl.anomalies);
router.get('/payment-breakdown', ctrl.paymentBreakdown);

module.exports = router;
