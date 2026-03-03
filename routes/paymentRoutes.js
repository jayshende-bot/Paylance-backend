const express = require('express');
const router = express.Router();
const { fundEscrow, releaseMilestone, refundMilestone, getHistory } = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { paymentLimiter } = require('../middleware/rateLimitMiddleware');

router.post('/fund-escrow', protect, authorize('client'), paymentLimiter, fundEscrow);
router.post('/release/:milestoneId', protect, authorize('client'), releaseMilestone);
router.post('/refund/:milestoneId', protect, authorize('client'), refundMilestone);
router.get('/history', protect, getHistory);

module.exports = router;
