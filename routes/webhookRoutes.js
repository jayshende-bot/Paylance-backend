const express = require('express');
const router = express.Router();
const { handleWebhook } = require('../controllers/webhookController');

// CRITICAL: Raw body required for Stripe signature verification
// This route must be registered BEFORE express.json() middleware in server.js
router.post('/', express.raw({ type: 'application/json' }), handleWebhook);

module.exports = router;
