const router = require('express').Router();

router.get('/health', (req, res) => res.json({ status: 'ok', service: 'fresh-fish-api', time: new Date().toISOString() }));

router.use('/auth', require('./auth.routes'));
router.use('/categories', require('./category.routes'));
router.use('/products', require('./product.routes'));
router.use('/orders', require('./order.routes'));
router.use('/payments', require('./payment.routes'));
router.use('/delivery-zones', require('./deliveryZone.routes'));
router.use('/addresses', require('./address.routes'));
router.use('/drivers', require('./driver.routes'));
router.use('/statistics', require('./statistics.routes'));
router.use('/reviews', require('./review.routes'));
router.use('/favorites', require('./favorite.routes'));
router.use('/coupons', require('./coupon.routes'));
router.use('/notifications', require('./notification.routes'));
router.use('/expenses', require('./expense.routes'));
router.use('/recurring-orders', require('./recurringOrder.routes'));
router.use('/customers', require('./customer.routes'));
router.use('/cron', require('./cron.routes'));

module.exports = router;
