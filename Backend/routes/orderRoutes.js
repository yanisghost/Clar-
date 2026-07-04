const express = require('express');
const rateLimit = require('express-rate-limit');
const orderController = require('../controllers/orderController');
const authController = require('../controllers/authController');

const router = express.Router();

// Stricter rate limiter for placing orders (max 5 orders per 15 minutes per IP)
const orderCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Too many orders created from this IP, please try again in 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Public routes ─────────────────────────────────────────────────────────────
router.route('/').post(orderCreationLimiter, authController.isLoggedIn, orderController.createOrder);
router.get('/my-orders', authController.protect, orderController.getMyOrders);
router.get('/:id/check-payment', orderController.checkPaymentStatus);
router.get('/:id/track', orderController.trackOrderById);

// Shipping fee calculator (no auth required — called at checkout)
router.get('/shipping-fee', orderController.getShippingFee);
router.get('/track-by-phone', orderController.trackByPhone);

// ── Admin / Manager only ──────────────────────────────────────────────────────
router.use(
  authController.protect,
  authController.restrictTo('admin', 'manager'),
);
router.route('/').get(orderController.getOrders);
router
  .route('/:id')
  .get(orderController.getOrder)
  .patch(orderController.updateOrder)
  .delete(orderController.deleteOrder);

// Yalidine delivery actions (admin and manager)
router.post('/:id/send-to-yalidine', authController.restrictTo('admin', 'manager'), orderController.sendToYalidine);
router.post('/:id/cancel-yalidine', authController.restrictTo('admin', 'manager'), orderController.cancelYalidineParcel);
router.post('/:id/sync-shipping', authController.restrictTo('admin', 'manager'), orderController.syncOrderShipping);

module.exports = router;
