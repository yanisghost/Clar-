const Product = require('../models/productModel');
const Pack = require('../models/packModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// STEP 1: Show checkout page with cart items
exports.checkoutPage = catchAsync(async (req, res, next) => {
  const { cartData } = req.body;

  let cart;
  try {
    cart = JSON.parse(cartData);
  } catch (err) {
    return next(new AppError('Invalid cart data', 400));
  }

  res.status(200).render('order', {
    cart,
    cartData,
    originalTotal: cart.reduce(
      (sum, item) => sum + (item.price || 0) * item.quantity,
      0,
    ),
    finalTotal: null,
    createdAt: new Date().toISOString(),
    mode: 'checkout',
  });
});

// STEP 2: Confirm order with per-product and pack discount codes
exports.confirmOrder = catchAsync(async (req, res, next) => {
  const { cartData } = req.body;

  let cart;
  try {
    cart = JSON.parse(cartData);
  } catch (err) {
    return next(new AppError('Invalid cart data', 400));
  }

  // --- Parse discount codes robustly ---
  let codesArray = [];

  if (req.body.discountCodesJson) {
    try {
      const parsed = JSON.parse(req.body.discountCodesJson);
      if (Array.isArray(parsed)) codesArray = parsed;
    } catch (err) {
      console.log('Failed to parse discountCodesJson:', err);
    }
  }

  if (
    codesArray.length === 0 &&
    typeof req.body.discountCodes !== 'undefined'
  ) {
    const raw = req.body.discountCodes;
    if (Array.isArray(raw)) {
      codesArray = raw;
    } else if (typeof raw === 'string') {
      codesArray = [raw];
    } else if (typeof raw === 'object' && raw !== null) {
      const keys = Object.keys(raw)
        .map((k) => (isFinite(k) ? Number(k) : null))
        .filter((k) => k !== null)
        .sort((a, b) => a - b);
      codesArray = keys.map((k) => raw[k]);
    }
  }

  const cleanedCodes = codesArray.map((c) => {
    if (c === null || typeof c === 'undefined') return null;
    if (typeof c !== 'string') return String(c).trim() || null;
    const t = c.trim();
    return t === '' ? null : t;
  });

  while (cleanedCodes.length < cart.length) cleanedCodes.push(null);
  if (cleanedCodes.length > cart.length) cleanedCodes.length = cart.length;

  cart.forEach((item, index) => {
    item.enteredCode = cleanedCodes[index] || null;
  });

  // --- Fetch all products and packs in one go ---
  const productIds = cart.filter((i) => i.type === 'product').map((i) => i.id);
  const packIds = cart.filter((i) => i.type === 'pack').map((i) => i.id);

  const productDocs = await Product.find({ _id: { $in: productIds } });
  const packDocs = await Pack.find({ _id: { $in: packIds } });

  // --- Apply discounts and compute totals ---
  let originalTotal = 0;
  let finalTotal = 0;

  for (const item of cart) {
    const now = Date.now();

    if (item.type === 'product') {
      const product = productDocs.find((p) => p._id.toString() === item.id);
      if (!product) {
        item.discountApplied = false;
        item.finalPrice = 0;
        continue;
      }

      const subtotal = product.price * item.quantity;
      originalTotal += subtotal;

      const autoDiscount = product.discounts?.find(
        (d) =>
          d.active &&
          d.requiresCode === false &&
          d.discountPrice < product.price &&
          (!d.discountStart || now >= new Date(d.discountStart).getTime()) &&
          (!d.discountEnd || now <= new Date(d.discountEnd).getTime()),
      );

      const codeDiscount = product.discounts?.find(
        (d) =>
          d.active &&
          d.requiresCode === true &&
          d.code === item.enteredCode &&
          d.discountPrice < product.price &&
          (!d.discountStart || now >= new Date(d.discountStart).getTime()) &&
          (!d.discountEnd || now <= new Date(d.discountEnd).getTime()),
      );

      let appliedDiscount = null;
      if (autoDiscount && codeDiscount) {
        appliedDiscount =
          autoDiscount.discountPrice <= codeDiscount.discountPrice
            ? autoDiscount
            : codeDiscount;
      } else {
        appliedDiscount = autoDiscount || codeDiscount;
      }

      if (appliedDiscount) {
        item.discountApplied = true;
        item.finalPrice = appliedDiscount.discountPrice * item.quantity;
        finalTotal += item.finalPrice;
      } else {
        item.discountApplied = false;
        item.finalPrice = subtotal;
        finalTotal += subtotal;
      }
    }

    if (item.type === 'pack') {
      const pack = packDocs.find((p) => p._id.toString() === item.id);
      if (!pack) {
        item.discountApplied = false;
        item.finalPrice = 0;
        continue;
      }

      const subtotal = pack.packPrice * item.quantity;
      originalTotal += subtotal;

      const autoDiscount = pack.discounts?.find(
        (d) =>
          !d.requiresCode &&
          d.active &&
          d.discountPrice < pack.packPrice &&
          (!d.discountStart || now >= new Date(d.discountStart).getTime()) &&
          (!d.discountEnd || now <= new Date(d.discountEnd).getTime()),
      );

      const codeDiscount = pack.discounts?.find(
        (d) =>
          d.requiresCode &&
          d.active &&
          item.enteredCode &&
          d.code === item.enteredCode &&
          d.discountPrice < pack.packPrice &&
          (!d.discountStart || now >= new Date(d.discountStart).getTime()) &&
          (!d.discountEnd || now <= new Date(d.discountEnd).getTime()),
      );

      let appliedDiscount = null;
      if (autoDiscount && codeDiscount) {
        appliedDiscount =
          autoDiscount.discountPrice <= codeDiscount.discountPrice
            ? autoDiscount
            : codeDiscount;
      } else {
        appliedDiscount = autoDiscount || codeDiscount;
      }

      if (appliedDiscount) {
        item.discountApplied = true;
        item.finalPrice = appliedDiscount.discountPrice * item.quantity;
        finalTotal += item.finalPrice;
      } else {
        item.discountApplied = false;
        item.finalPrice = subtotal;
        finalTotal += subtotal;
      }
    }
  }

  res.status(200).render('order', {
    cart,
    cartData,
    originalTotal,
    finalTotal,
    createdAt: new Date().toISOString(),
    mode: 'confirm',
  });
});
