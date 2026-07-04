const catchAsync = require('../utils/catchAsync');
const Product = require('../models/productModel');
const Pack = require('../models/packModel');
const AppError = require('../utils/appError');

// ================== PRODUCTS ==================

exports.applyDiscount = catchAsync(async (req, res, next) => {
  const { productId } = req.params;
  const product = await Product.findById(productId);

  if (!product) return next(new AppError('No product found with that ID', 404));

  // req.body can contain: { code, discountPrice, discountStart, discountEnd, active, requiresCode }
  const {
    code,
    discountPrice,
    discountStart,
    discountEnd,
    active,
    requiresCode,
  } = req.body;

  product.discounts.push({
    code: requiresCode ? code : null, // only store code if required
    discountPrice,
    discountStart,
    discountEnd,
    active: active !== undefined ? active : true,
    requiresCode: requiresCode !== undefined ? requiresCode : true,
  });

  const updated = await product.save();

  res.status(200).json({
    status: 'success',
    data: {
      product: updated,
      finalPrice: updated.finalPrice,
      discountPercent: updated.discountPercent,
      discounts: updated.discounts,
    },
  });
});

exports.updateProductDiscount = catchAsync(async (req, res, next) => {
  const { productId, discountId } = req.params;
  const product = await Product.findById(productId);

  if (!product) return next(new AppError('No product found with that ID', 404));

  const discount = product.discounts.id(discountId);
  if (!discount)
    return next(new AppError('No discount found with that ID', 404));

  // Apply updates from req.body
  Object.assign(discount, req.body);

  const updated = await product.save();

  res.status(200).json({
    status: 'success',
    data: {
      product: updated,
      discounts: updated.discounts,
      finalPrice: updated.finalPrice,
      discountPercent: updated.discountPercent,
    },
  });
});

exports.deleteProductDiscount = catchAsync(async (req, res, next) => {
  const { productId, discountId } = req.params;
  const product = await Product.findById(productId);

  if (!product) return next(new AppError('No product found with that ID', 404));

  const discount = product.discounts.id(discountId);
  if (!discount)
    return next(new AppError('No discount found with that ID', 404));

  product.discounts.pull(discountId);

  const updated = await product.save();

  res.status(200).json({
    status: 'success',
    message: 'Discount removed successfully',
    data: {
      product: updated,
      discounts: updated.discounts,
      finalPrice: updated.finalPrice,
      discountPercent: updated.discountPercent,
    },
  });
});

// ================== PACKS ==================

exports.applyPackDiscount = catchAsync(async (req, res, next) => {
  const { packId } = req.params;
  const pack = await Pack.findById(packId);

  if (!pack) return next(new AppError('No pack found with that ID', 404));

  const {
    code,
    discountPrice,
    discountStart,
    discountEnd,
    active,
    requiresCode,
  } = req.body;

  pack.discounts.push({
    code: requiresCode ? code : null,
    discountPrice,
    discountStart,
    discountEnd,
    active: active !== undefined ? active : true,
    requiresCode: requiresCode !== undefined ? requiresCode : true,
  });

  const updated = await pack.save();

  res.status(200).json({
    status: 'success',
    data: {
      pack: updated,
      finalPrice: updated.finalPrice,
      savings: updated.savings,
      savingsPercent: updated.savingsPercent,
      discounts: updated.discounts,
    },
  });
});

exports.updatePackDiscount = catchAsync(async (req, res, next) => {
  const { packId, discountId } = req.params;
  const pack = await Pack.findById(packId);

  if (!pack) return next(new AppError('No pack found with that ID', 404));

  const discount = pack.discounts.id(discountId);
  if (!discount)
    return next(new AppError('No discount found with that ID', 404));

  Object.assign(discount, req.body);

  const updated = await pack.save();

  res.status(200).json({
    status: 'success',
    data: {
      pack: updated,
      discounts: updated.discounts,
      finalPrice: updated.finalPrice,
      savings: updated.savings,
      savingsPercent: updated.savingsPercent,
    },
  });
});

exports.deletePackDiscount = catchAsync(async (req, res, next) => {
  const { packId, discountId } = req.params;
  const pack = await Pack.findById(packId);

  if (!pack) return next(new AppError('No pack found with that ID', 404));

  const discount = pack.discounts.id(discountId);
  if (!discount)
    return next(new AppError('No discount found with that ID', 404));

  pack.discounts.pull(discountId);

  const updated = await pack.save();

  res.status(200).json({
    status: 'success',
    message: 'Discount removed successfully',
    data: {
      pack: updated,
      discounts: updated.discounts,
      finalPrice: updated.finalPrice,
      savings: updated.savings,
      savingsPercent: updated.savingsPercent,
    },
  });
});
