const express = require('express');
const router = express.Router();
const { onboard, getStatus, getDashboardLink, triggerPayout } = require('../controllers/stripeConnectController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.post('/onboard', protect, authorize('freelancer'), onboard);
router.get('/status', protect, authorize('freelancer'), getStatus);
router.get('/dashboard', protect, authorize('freelancer'), getDashboardLink);
router.post('/payout', protect, authorize('freelancer'), triggerPayout);

module.exports = router;
