const express = require('express');
const packController = require('../controllers/packController');
const authController = require('../controllers/authController');

const router = express.Router();

router.route('/').get(packController.getAllPacks);
router.route('/:id').get(packController.getPack);

router.use(
  authController.protect,
  authController.restrictTo('admin', 'manager'),
);
router.post(
  '/',
  packController.uploadPackImages,
  packController.parseJsonFields,
  packController.resizePackImages,
  packController.createPack,
);
router
  .route('/:id')
  .patch(
    packController.uploadPackImages,
    packController.parseJsonFields,
    packController.updatePackImages,
    packController.updatePack,
  )
  .delete(packController.deletePack);

module.exports = router;
