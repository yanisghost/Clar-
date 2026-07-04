const express = require('express');
const discountController = require('../controllers/discountController');
const authController = require('../controllers/authController');

const router = express.Router();

// ✅ Apply auth middleware once for all discount routes
router.use(authController.protect, authController.restrictTo('admin'));

// -------------------- Product discount routes --------------------
router.post('/products/:productId', discountController.applyDiscount);
router.patch(
  '/products/:productId/:discountId',
  discountController.updateProductDiscount,
);
router.delete(
  '/products/:productId/:discountId',
  discountController.deleteProductDiscount,
);

// -------------------- Pack discount routes --------------------
router.post('/packs/:packId', discountController.applyPackDiscount);
router.patch(
  '/packs/:packId/:discountId',
  discountController.updatePackDiscount,
);
router.delete(
  '/packs/:packId/:discountId',
  discountController.deletePackDiscount,
);

module.exports = router;
