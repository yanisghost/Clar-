// routes/shippingRoutes.js
const express = require('express');
const shippingController = require('../controllers/shippingController');
const authController = require('../controllers/authController');

const router = express.Router();

// Public Webhook listener for courier callbacks
router.post('/webhooks/:provider', shippingController.receiveWebhook);

// Protected routes (Admin & Manager only)
router.use(authController.protect);
router.use(authController.restrictTo('admin', 'manager'));

router.get('/stats', shippingController.getShippingStats);
router.get('/parcels', shippingController.getShippingParcels);

module.exports = router;
