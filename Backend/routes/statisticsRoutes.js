// routes/statisticsRoutes.js
const express = require('express');
const statsController = require('../controllers/statisticsController');
const authController = require('../controllers/authController');

const router = express.Router();

// All stats routes require logging in
router.use(authController.protect);

router.get('/', authController.restrictTo('admin', 'manager'), statsController.getDashboardStats);

// Manager and Admin can see standard store dashboard metrics
router.get('/sales', authController.restrictTo('admin', 'manager'), statsController.getSalesStats);
router.get('/trends', authController.restrictTo('admin', 'manager'), statsController.getSalesTrends);
router.get('/products/top', authController.restrictTo('admin', 'manager'), statsController.getTopProducts);
router.get('/inventory/low', authController.restrictTo('admin', 'manager'), statsController.getLowInventory);

// Only Admin can see sensitive financial loss/refund and discount performance analytics
router.get('/loss', authController.restrictTo('admin'), statsController.getLossStats);
router.get('/refunds', authController.restrictTo('admin'), statsController.getRefundStats);
router.get('/discounts/impact', authController.restrictTo('admin'), statsController.getDiscountImpact);
router.get('/refunds/analytics', authController.restrictTo('admin'), statsController.getRefundAnalytics);
router.get('/loss/analytics', authController.restrictTo('admin'), statsController.getLossAnalytics);

module.exports = router;
