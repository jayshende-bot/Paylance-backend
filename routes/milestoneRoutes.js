const express = require('express');
const router = express.Router();
const { createMilestone, getContractMilestones, submitMilestone, disputeMilestone } = require('../controllers/milestoneController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.post('/', protect, authorize('client'), createMilestone);
router.get('/contract/:contractId', protect, getContractMilestones);
router.post('/:id/submit', protect, authorize('freelancer'), submitMilestone);
router.patch('/:id/dispute', protect, disputeMilestone);

module.exports = router;
