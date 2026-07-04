// controllers/shippingController.js
const Order = require('../models/orderModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const ShippingService = require('../utils/shippingService');

exports.getShippingStats = catchAsync(async (req, res, next) => {
  const stats = await Order.aggregate([
    {
      $match: {
        $or: [
          { 'shipping.trackingNumber': { $exists: true, $ne: null } },
          { 'yalidineTracking': { $exists: true, $ne: null } }
        ]
      }
    },
    {
      $group: {
        _id: null,
        totalParcels: { $sum: 1 },
        delivered: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ['$shipping.status', 'delivered'] },
                  { $eq: ['$yalidineStatus', 'Livré'] }
                ]
              },
              1,
              0
            ]
          }
        },
        shipped: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ['$shipping.status', 'shipped'] },
                  { $eq: ['$yalidineStatus', 'Sorti en livraison'] },
                  { $eq: ['$yalidineStatus', 'En transit'] },
                  { $eq: ['$yalidineStatus', 'Vers Wilaya'] }
                ]
              },
              1,
              0
            ]
          }
        },
        returned: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ['$shipping.status', 'returned'] },
                  { $eq: ['$yalidineStatus', 'Retourné au vendeur'] }
                ]
              },
              1,
              0
            ]
          }
        },
        failed: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ['$shipping.status', 'failed'] },
                  { $eq: ['$yalidineStatus', 'Tentative échouée'] }
                ]
              },
              1,
              0
            ]
          }
        }
      }
    }
  ]);

  const result = stats[0] || {
    totalParcels: 0,
    delivered: 0,
    shipped: 0,
    returned: 0,
    failed: 0
  };

  res.status(200).json({
    status: 'success',
    data: result
  });
});

exports.getShippingParcels = catchAsync(async (req, res, next) => {
  const queryObj = {
    $or: [
      { 'shipping.trackingNumber': { $exists: true, $ne: null } },
      { 'yalidineTracking': { $exists: true, $ne: null } }
    ]
  };

  if (req.query.search) {
    const searchRegex = new RegExp(req.query.search, 'i');
    queryObj.$and = [
      {
        $or: [
          { 'shipping.trackingNumber': searchRegex },
          { yalidineTracking: searchRegex },
          { customerName: searchRegex },
          { phoneNumber: searchRegex }
        ]
      }
    ];
  }

  if (req.query.provider) {
    queryObj['shipping.provider'] = req.query.provider;
  }

  if (req.query.status) {
    queryObj['shipping.status'] = req.query.status;
  }

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const parcels = await Order.find(queryObj)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Order.countDocuments(queryObj);

  res.status(200).json({
    status: 'success',
    results: parcels.length,
    total,
    data: parcels
  });
});

exports.receiveWebhook = catchAsync(async (req, res, next) => {
  const { provider } = req.params;
  console.log(`[Webhook] Received shipping webhook for provider: ${provider}`);
  console.log('Payload:', req.body);

  const payload = req.body;

  if (provider === 'yalidine') {
    const tracking = payload.tracking;
    const rawStatus = payload.status;
    const location = payload.wilaya_name || payload.commune_name || '';
    const reason = payload.reason || '';

    if (tracking && rawStatus) {
      const order = await Order.findOne({
        $or: [
          { 'shipping.trackingNumber': tracking },
          { yalidineTracking: tracking }
        ]
      });

      if (order) {
        order.yalidineStatus = rawStatus;
        const mappedStatus = ShippingService.mapStatusToOpzia('yalidine', rawStatus);
        if (mappedStatus) {
          order.shipping.status = mappedStatus;
          order.status = mappedStatus;
        }
        
        order.shipping.history.push({
          status: rawStatus,
          location,
          reason,
          timestamp: new Date()
        });

        await order.save({ validateBeforeSave: false });
        console.log(`[Webhook] Order ${order._id} updated via Yalidine webhook to status: ${rawStatus}`);
      }
    }
  }

  res.status(200).json({
    status: 'success',
    message: 'Webhook processed successfully'
  });
});
