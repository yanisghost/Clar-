// routes/webhookRoutes.js
// Yalidine / Guepex webhook endpoint.
//
// NOTE: The POST route receives raw body (Buffer) — express.raw() is applied
// in app.js BEFORE the global express.json() middleware so HMAC verification works.

const express = require('express');
const webhookController = require('../controllers/webhookController');

const router = express.Router();

// GET — CRC Challenge-Response validation (Yalidine validates endpoint ownership)
router.get('/', webhookController.validateCRC);

// POST — Event delivery from Yalidine
// Body is already a Buffer (express.raw applied in app.js for this path)
router.post('/', webhookController.handleEvent);

module.exports = router;
