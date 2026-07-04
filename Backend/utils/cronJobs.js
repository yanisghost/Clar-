const cron = require('node-cron');
const Order = require('../models/orderModel');
const { OCPay, PaymentStatus } = require('@oneclickdz/ocpay-sdk');
const sendTelegramNotification = require('./telegram');

const ocpay = new OCPay(process.env.ONECLICK_API_KEY);

const initPaymentCheckCron = () => {
  // Run status verification task every 20 minutes
  cron.schedule('*/20 * * * *', async () => {
    console.log('[Cron Job] Checking for pending CIB/Dahabia payments...');

    try {
      // Find orders created in the last 24 hours that are still pending online payment
      const pendingOrders = await Order.find({
        status: 'pending',
        paymentMethod: { $in: ['dahabia', 'cib'] },
        paymentRef: { $exists: true },
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      });

      console.log(`[Cron Job] Found ${pendingOrders.length} pending orders to verify.`);

      for (const order of pendingOrders) {
        try {
          const statusResult = await ocpay.checkPayment(order.paymentRef);
          const navioStatus = statusResult.status; // PENDING, CONFIRMED, or FAILED

          if (navioStatus === PaymentStatus.CONFIRMED) {
            order.status = 'confirmed';
            await order.save(); // Will automatically deduct stock via pre-save middleware in orderModel

            // Notify Admin
            const plainOrder = order.toObject();
            await sendTelegramNotification(plainOrder);
            console.log(`[Cron Job] Paid: Order ${order._id} confirmed.`);
          } else if (navioStatus === PaymentStatus.FAILED) {
            order.status = 'cancelled';
            await order.save();
            console.log(`[Cron Job] Failed: Order ${order._id} cancelled.`);
          }
          
          // Yield 100ms between calls to prevent rate limits
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (err) {
          console.error(`[Cron Job] Error checking order ${order._id}:`, err.message);
        }
      }
    } catch (error) {
      console.error('[Cron Job Error]:', error.message);
    }
  });
};

module.exports = initPaymentCheckCron;
