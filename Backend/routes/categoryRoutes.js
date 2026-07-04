const express = require('express');
const authController = require('../controllers/authController');
const categoryController = require('../controllers/categoryController');

const router = express.Router();

router.route('/').get(categoryController.getCategories);
router.route('/:id').get(categoryController.getCategory);

router.use(
  authController.protect,
  authController.restrictTo('admin', 'manager'),
);

router.route('/').post(
  categoryController.uploadCategoryImage,
  categoryController.resizeCategoryImage,
  categoryController.createCategory,
);
router
  .route('/:id')
  .patch(
    categoryController.uploadCategoryImage,
    categoryController.resizeCategoryImage,
    categoryController.updateCategory,
  )
  .delete(categoryController.deleteCategory);

module.exports = router;
