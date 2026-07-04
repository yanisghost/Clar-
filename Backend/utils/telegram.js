const axios = require('axios');

async function sendTelegramNotification(order) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  // Debug: log the whole order object
  console.log('=== DEBUG: Order object passed to Telegram ===');
  console.log(JSON.stringify(order, null, 2));

  // Debug: log products array
  console.log('=== DEBUG: Products array ===');
  (order.products || []).forEach((p, idx) => {
    console.log(`Product[${idx}] ->`, p);
  });

  // Debug: log packs array
  console.log('=== DEBUG: Packs array ===');
  (order.packs || []).forEach((pk, idx) => {
    console.log(`Pack[${idx}] ->`, pk);
  });

  // Build product list (use finalPrice instead of price)
  const productLines = (order.products || [])
    .map((p) => `🛒 ${p.name} x${p.quantity} — ${p.finalPrice}`)
    .join('\n');

  // Build pack list
  const packLines = (order.packs || [])
    .map((pk) => {
      const innerProducts = (pk.products || [])
        .map((ip) => `   • ${ip.name} x${ip.quantity} — ${ip.price}`)
        .join('\n');
      return `📦 ${pk.name} x${pk.quantity} — ${pk.finalPrice}\n${innerProducts}`;
    })
    .join('\n\n');

  const message = `
📢 *New Order Received!*

👤 Customer: ${order.customerName}
📞 Phone: ${order.phoneNumber}
📍 Address: ${order.wilaya}, ${order.baladia}, ${order.homeAddress}
💳 Payment: ${order.paymentMethod}

💰 Total: ${order.totalAmount}
📈 Profit: ${order.totalProfit}

${productLines ? `Products:\n${productLines}` : ''}
${packLines ? `Packs:\n${packLines}` : ''}
  `;

  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🔗 View Order',
              url: `https://yourdomain.com/orders/${order._id}`, // replace with your actual order page
            },
          ],
          [
            {
              text: '📦 Mark as Shipped',
              url: `https://yourdomain.com/orders/${order._id}/ship`, // or use callback_data if you want bot actions
            },
            {
              text: '🧾 Download Invoice',
              url: `https://yourdomain.com/orders/${order._id}/invoice`,
            },
          ],
        ],
      },
    });
    console.log('Telegram notification sent with buttons!');
  } catch (err) {
    console.error('Failed to send Telegram notification:', err.message);
  }
}

module.exports = sendTelegramNotification;
