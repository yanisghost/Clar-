// controllers/webhookController.js
// Handles Yalidine / Guepex webhook events.
//
// Two routes are handled:
//   GET  /api/v1/webhooks/yalidine  — CRC Challenge-Response validation
//   POST /api/v1/webhooks/yalidine  — Event delivery
//
// IMPORTANT: The POST route must use express.raw() middleware (not express.json())
// so that the raw body is available for HMAC-SHA256 signature verification.

const crypto = require('crypto');
const Order = require('../models/orderModel');
const { mapYalidineStatusToOpzia } = require('../utils/yalidine');

// In-memory deduplication set (resets on server restart; fine for our scale)
// For production at high volume, persist to Redis or MongoDB.
const processedEventIds = new Set();

// ─── GET — CRC Challenge Validation ──────────────────────────────────────────
// Yalidine sends GET ?subscribe=1&crc_token=XXX to validate that we own the URL.
// We must echo back the crc_token value with HTTP 200 within 10 seconds.
exports.validateCRC = (req, res) => {
  const { subscribe, crc_token } = req.query;
  if (subscribe !== undefined && crc_token) {
    return res.status(200).send(crc_token);
  }
  // If it's a plain GET without validation params, respond with 200 OK
  return res.status(200).json({ status: 'ok' });
};

// ─── POST — Event Delivery ────────────────────────────────────────────────────
exports.handleEvent = async (req, res) => {
  // 1. Signature verification
  const signature = req.headers['x-yalidine-signature'] || req.headers['x_yalidine_signature'];

  if (!signature) {
    return res.status(400).json({ error: 'Missing signature' });
  }

  const secretKey = process.env.YALIDINE_WEBHOOK_SECRET || '';
  const rawBody = req.body; // Buffer (because we use express.raw())
  const computedSignature = crypto
    .createHmac('sha256', secretKey)
    .update(rawBody)
    .digest('hex');

  if (signature !== computedSignature) {
    if (process.env.YALIDINE_SANDBOX === 'true' && signature === 'sandbox-bypass') {
      console.log('[Yalidine Webhook] Sandbox mode active — bypassing HMAC verification');
    } else {
      console.warn('[Yalidine Webhook] Invalid signature — ignoring payload');
      return res.status(400).json({ error: 'Invalid signature' });
    }
  }

  // 2. Return 200 immediately — process events asynchronously
  res.status(200).json({ received: true });

  // 3. Parse and process events (after responding)
  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch (err) {
    console.error('[Yalidine Webhook] Failed to parse payload:', err.message);
    return;
  }

  const { type, events } = payload;
  if (!type || !Array.isArray(events)) return;

  console.log(`[Yalidine Webhook] Received ${events.length} event(s) of type "${type}"`);

  for (const event of events) {
    // Deduplication
    if (processedEventIds.has(event.event_id)) {
      console.log(`[Yalidine Webhook] Skipping duplicate event ${event.event_id}`);
      continue;
    }
    processedEventIds.add(event.event_id);

    // Limit dedup set size to avoid memory leaks
    if (processedEventIds.size > 10000) {
      const first = processedEventIds.values().next().value;
      processedEventIds.delete(first);
    }

    try {
      await processEvent(type, event);
    } catch (err) {
      console.error(`[Yalidine Webhook] Error processing event ${event.event_id}:`, err.message);
    }
  }
};

// ─── Event processor ─────────────────────────────────────────────────────────
async function processEvent(type, event) {
  const { data } = event;

  switch (type) {
    case 'parcel_created': {
      // Save tracking + label on the matching order (by order_id = order._id)
      if (!data.tracking) break;
      await Order.findByIdAndUpdate(
        data.order_id,
        {
          yalidineTracking: data.tracking,
          yalidineStatus: 'En préparation',
          ...(data.label ? { yalidineLabelUrl: data.label } : {}),
        },
        { runValidators: false }
      );
      console.log(`[Yalidine Webhook] parcel_created: ${data.tracking} → order ${data.order_id}`);
      break;
    }

    case 'parcel_edited': {
      // Update label URL if changed
      if (!data.tracking) break;
      const update = {};
      if (data.label) update.yalidineLabelUrl = data.label;
      if (Object.keys(update).length > 0) {
        await Order.findOneAndUpdate(
          { yalidineTracking: data.tracking },
          update,
          { runValidators: false }
        );
      }
      console.log(`[Yalidine Webhook] parcel_edited: ${data.tracking}`);
      break;
    }

    case 'parcel_deleted': {
      if (!data.tracking) break;
      await Order.findOneAndUpdate(
        { yalidineTracking: data.tracking },
        { yalidineStatus: 'deleted', yalidineTracking: null, yalidineLabelUrl: null },
        { runValidators: false }
      );
      console.log(`[Yalidine Webhook] parcel_deleted: ${data.tracking}`);
      break;
    }

    case 'parcel_status_updated': {
      if (!data.tracking || !data.status) break;

      // Map Yalidine status → Opzia order status
      const opziaStatus = mapYalidineStatusToOpzia(data.status);

      const update = { yalidineStatus: data.status };
      if (opziaStatus) update.status = opziaStatus;

      await Order.findOneAndUpdate(
        { yalidineTracking: data.tracking },
        update,
        { runValidators: false }
      );

      console.log(
        `[Yalidine Webhook] parcel_status_updated: ${data.tracking} → "${data.status}"${opziaStatus ? ` (order → ${opziaStatus})` : ''}`
      );
      break;
    }

    case 'parcel_payment_updated': {
      // Log for visibility; payment tracking is managed in Yalidine's own dashboard
      console.log(
        `[Yalidine Webhook] parcel_payment_updated: ${data.tracking} payment_status="${data.status}" payment_id=${data.payment_id}`
      );
      break;
    }

    default:
      console.log(`[Yalidine Webhook] Unknown event type: ${type}`);
  }
}
