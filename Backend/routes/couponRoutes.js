const express = require('express');
const couponController = require('../controllers/couponController');
const authController = require('../controllers/authController');

const router = express.Router();

// Public route to validate a coupon
router.get('/validate', couponController.validateCoupon);

// Protect all admin endpoints below
router.use(authController.protect, authController.restrictTo('admin', 'manager'));

router
  .route('/')
  .get(couponController.getAllCoupons)
  .post(couponController.createCoupon);

router
  .route('/:id')
  .get(couponController.getCoupon)
  .patch(couponController.updateCoupon)
  .delete(couponController.deleteCoupon);

module.exports = router;
