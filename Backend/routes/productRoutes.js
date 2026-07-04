const express = require('express');
const productController = require('../controllers/productController');
const authController = require('../controllers/authController');

const router = express.Router();

router
  .route('/')
  .post(
    authController.protect,
    authController.restrictTo('admin', 'manager'),
    productController.uploadProductImages,
    productController.resizeProductImages,
    productController.createProduct,
  )
  .get(productController.getAllProducts);
router
  .route('/:id')
  .get(productController.getProduct)
  .patch(
    authController.protect,
    authController.restrictTo('admin', 'manager'),
    productController.uploadProductImages,
    productController.resizeProductImages,
    productController.updateProduct,
  )
  .delete(
    authController.protect,
    authController.restrictTo('admin', 'manager'),
    productController.deleteProduct,
  );
module.exports = router;
