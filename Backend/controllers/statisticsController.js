// controllers/statisticsController.js
const Order = require('../models/orderModel');
const Product = require('../models/productModel');
const APIFeatures = require('../utils/apiFeatures');
const catchAsync = require('../utils/catchAsync');

exports.getSalesStats = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(null, req.query);
  const matchStage = features.filterMatch();

  // ✅ Remove "loss" from matchStage if present
  if (matchStage.loss) {
    delete matchStage.loss;
  }

  // ✅ Default to delivered if no status is provided
  if (!req.query.status) {
    matchStage.status = 'delivered';
  }

  // ✅ Refunds
  if (req.query.status === 'cancelled') {
    matchStage.status = 'cancelled';
  }

  // ✅ Loss orders
  if (req.query.loss === 'true') {
    matchStage.status = 'delivered';
    matchStage.totalProfit = { $lt: 0 };
  }

  const stats = await Order.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$totalAmount' },
        totalProfit: { $sum: '$totalProfit' },
        totalOrders: { $sum: 1 },
        avgOrderValue: { $avg: '$totalAmount' },
      },
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: stats[0] || {
      totalRevenue: 0,
      totalProfit: 0,
      totalOrders: 0,
      avgOrderValue: 0,
    },
  });
});

exports.getSalesTrends = catchAsync(async (req, res, next) => {
  // ✅ Build $match from query params, but exclude "interval"
  // eslint-disable-next-line node/no-unsupported-features/es-syntax
  const queryCopy = { ...req.query };
  delete queryCopy.interval;

  const features = new APIFeatures(null, queryCopy);
  const matchStage = features.filterMatch();

  // ✅ Add refund & loss filters
  if (req.query.status === 'refunded') {
    matchStage.status = 'refunded';
  }
  if (req.query.loss === 'true') {
    // Remove any stray "loss" field from matchStage
    if (matchStage.loss) delete matchStage.loss;

    // Force delivered + negative profit
    matchStage.status = 'delivered';
    matchStage.totalProfit = { $lt: 0 };
  }

  // ✅ Choose interval (default = day)
  const interval = req.query.interval || 'day';
  let dateFormat;
  switch (interval) {
    case 'day':
      dateFormat = '%Y-%m-%d';
      break;
    case 'week':
      dateFormat = '%Y-%U';
      break;
    case 'month':
      dateFormat = '%Y-%m';
      break;
    case 'year':
      dateFormat = '%Y';
      break;
    default:
      dateFormat = '%Y-%m-%d';
  }

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
        totalRevenue: { $sum: '$totalAmount' },
        totalProfit: { $sum: '$totalProfit' },
        totalOrders: { $sum: 1 },
        avgOrderValue: { $avg: '$totalAmount' },
      },
    },
    { $sort: { _id: 1 } },
  ];

  const stats = await Order.aggregate(pipeline);

  res.status(200).json({
    status: 'success',
    interval,
    data: stats,
  });
});

// Loss Orders Stats
exports.getLossStats = catchAsync(async (req, res, next) => {
  const stats = await Order.aggregate([
    { $match: { status: 'delivered', totalProfit: { $lt: 0 } } },
    {
      $group: {
        _id: null,
        totalLossOrders: { $sum: 1 },
        totalLossAmount: { $sum: '$totalProfit' }, // negative sum
        avgLossPerOrder: { $avg: '$totalProfit' },
      },
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: stats[0] || {
      totalLossOrders: 0,
      totalLossAmount: 0,
      avgLossPerOrder: 0,
    },
  });
});

// Refund Orders Stats
exports.getRefundStats = catchAsync(async (req, res, next) => {
  const stats = await Order.aggregate([
    { $match: { status: 'cancelled' } },
    {
      $group: {
        _id: null,
        totalRefundOrders: { $sum: 1 },
        totalRefundAmount: { $sum: '$totalAmount' },
        avgRefundPerOrder: { $avg: '$totalAmount' },
      },
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: stats[0] || {
      totalRefundOrders: 0,
      totalRefundAmount: 0,
      avgRefundPerOrder: 0,
    },
  });
});

exports.getTopProducts = catchAsync(async (req, res, next) => {
  const stats = await Order.aggregate([
    { $unwind: '$products' }, // flatten products array
    {
      $group: {
        _id: '$products.product', // group by productId
        totalQuantity: { $sum: '$products.quantity' },
        totalRevenue: {
          $sum: { $multiply: ['$products.quantity', '$products.finalPrice'] },
        },
        totalProfit: { $sum: '$products.profit' },
      },
    },
    { $sort: { totalQuantity: -1 } }, // sort by quantity sold
    { $limit: 10 }, // top 10 products
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'productDetails',
      },
    },
    {
      $unwind: {
        path: '$productDetails',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: 1,
        totalQuantitySold: '$totalQuantity',
        totalRevenue: 1,
        totalProfit: 1,
        name: { $ifNull: ['$productDetails.name', 'Deleted Product'] },
        imageCover: '$productDetails.imageCover',
        category: '$productDetails.category',
      },
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: stats,
  });
});

exports.getLowInventory = catchAsync(async (req, res, next) => {
  const threshold = parseInt(req.query.threshold, 10) || 10; // default threshold
  const products = await Product.find({ stock: { $lt: threshold } });

  res.status(200).json({
    status: 'success',
    threshold,
    data: products,
  });
});

exports.getDiscountImpact = catchAsync(async (req, res, next) => {
  const stats = await Order.aggregate([
    { $match: { discountAmount: { $gt: 0 } } },
    {
      $group: {
        _id: '$discountCode',
        totalDiscountGiven: { $sum: '$discountAmount' },
        totalRevenue: { $sum: '$totalAmount' },
        totalProfit: { $sum: '$totalProfit' },
        ordersWithDiscount: { $sum: 1 },
      },
    },
    { $sort: { totalDiscountGiven: -1 } },
  ]);

  res.status(200).json({
    status: 'success',
    data: stats,
  });
});

exports.getRefundAnalytics = catchAsync(async (req, res, next) => {
  const stats = await Order.aggregate([
    { $match: { status: 'cancelled' } },
    {
      $group: {
        _id: null,
        totalRefundOrders: { $sum: 1 },
        totalRefundAmount: { $sum: '$totalAmount' },
        avgRefundAmount: { $avg: '$totalAmount' },
      },
    },
  ]);

  const totalOrders = await Order.countDocuments();
  const refundRate =
    totalOrders > 0 ? (stats[0]?.totalRefundOrders || 0) / totalOrders : 0;

  res.status(200).json({
    status: 'success',
    data: {
      ...stats[0],
      refundRate,
    },
  });
});

exports.getLossAnalytics = catchAsync(async (req, res, next) => {
  const stats = await Order.aggregate([
    { $match: { status: 'delivered', totalProfit: { $lt: 0 } } },
    {
      $group: {
        _id: null,
        totalLossOrders: { $sum: 1 },
        totalLossAmount: { $sum: '$totalProfit' }, // negative sum
        avgLossPerOrder: { $avg: '$totalProfit' },
      },
    },
  ]);

  const deliveredOrders = await Order.countDocuments({ status: 'delivered' });
  const lossRate =
    deliveredOrders > 0
      ? (stats[0]?.totalLossOrders || 0) / deliveredOrders
      : 0;

  res.status(200).json({
    status: 'success',
    data: {
      ...stats[0],
      lossRate,
    },
  });
});

exports.getDashboardStats = catchAsync(async (req, res, next) => {
  const financials = await Order.aggregate([
    { $match: { status: { $ne: 'cancelled' } } },
    {
      $group: {
        _id: null,
        revenue: { $sum: '$totalAmount' },
        profit: { $sum: '$totalProfit' },
      },
    },
  ]);

  const totalOrders = await Order.countDocuments();

  const statusStats = await Order.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  const yalidineStats = await Order.aggregate([
    {
      $group: {
        _id: { $ifNull: ['$shipping.status', 'draft'] },
        count: { $sum: 1 },
      },
    },
  ]);

  const fin = financials[0] || { revenue: 0, profit: 0 };

  res.status(200).json({
    status: 'success',
    data: {
      revenue: fin.revenue,
      profit: fin.profit,
      totalOrders,
      statusStats,
      yalidineStats,
    },
  });
});

