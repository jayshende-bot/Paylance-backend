const express = require('express');
const router = express.Router();
const { createSubscription, cancelSubscription, getStatus } = require('../controllers/subscriptionController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.post('/create', protect, authorize('freelancer'), createSubscription);
router.delete('/cancel', protect, authorize('freelancer'), cancelSubscription);
router.get('/status', protect, getStatus);

module.exports = router;
