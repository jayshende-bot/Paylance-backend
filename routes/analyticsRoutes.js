const express = require('express');
const router = express.Router();
const { getFreelancerAnalytics, getAdminAnalytics } = require('../controllers/analyticsController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.get('/freelancer', protect, authorize('freelancer'), getFreelancerAnalytics);
router.get('/admin', protect, authorize('admin'), getAdminAnalytics);

module.exports = router;
