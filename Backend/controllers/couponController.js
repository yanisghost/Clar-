const Coupon = require('../models/couponModel');
const factory = require('./handlerFactory');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.validateCoupon = catchAsync(async (req, res, next) => {
  const { code, subtotal } = req.query;

  if (!code) {
    return next(new AppError('Please provide a coupon code.', 400));
  }

  const coupon = await Coupon.findOne({ code: code.toUpperCase() });

  if (!coupon) {
    return res.status(200).json({
      status: 'success',
      data: { valid: false, message: 'Invalid coupon code.' },
    });
  }

  // Check if active
  if (!coupon.active) {
    return res.status(200).json({
      status: 'success',
      data: { valid: false, message: 'This coupon is inactive.' },
    });
  }

  const now = new Date();

  // Check startDate
  if (coupon.startDate && now < coupon.startDate) {
    return res.status(200).json({
      status: 'success',
      data: { valid: false, message: 'This coupon has not started yet.' },
    });
  }

  // Check endDate
  if (coupon.endDate && now > coupon.endDate) {
    return res.status(200).json({
      status: 'success',
      data: { valid: false, message: 'This coupon has expired.' },
    });
  }

  // Check maxUses
  if (coupon.maxUses && coupon.usesCount >= coupon.maxUses) {
    return res.status(200).json({
      status: 'success',
      data: { valid: false, message: 'This coupon has reached its usage limit.' },
    });
  }

  // Check minOrderAmount
  const subtotalNum = Number(subtotal) || 0;
  if (coupon.minOrderAmount && subtotalNum < coupon.minOrderAmount) {
    return res.status(200).json({
      status: 'success',
      data: {
        valid: false,
        message: `This coupon requires a minimum spend of ${coupon.minOrderAmount}.`,
      },
    });
  }

  // Calculate discount
  let discountAmount = 0;
  if (coupon.discountType === 'percent') {
    discountAmount = (subtotalNum * coupon.value) / 100;
  } else {
    discountAmount = coupon.value;
  }

  // Cap discount at subtotal
  if (discountAmount > subtotalNum) {
    discountAmount = subtotalNum;
  }

  res.status(200).json({
    status: 'success',
    data: {
      valid: true,
      discountAmount,
      discountType: coupon.discountType,
      value: coupon.value,
    },
  });
});

exports.getAllCoupons = factory.getAll(Coupon);
exports.getCoupon = factory.getOne(Coupon);
exports.createCoupon = factory.createOne(Coupon);
exports.updateCoupon = factory.updateOne(Coupon);
exports.deleteCoupon = factory.deleteOne(Coupon);
