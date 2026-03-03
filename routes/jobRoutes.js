const express = require('express');
const router = express.Router();
const {
  getJobs, getJob, createJob, updateJob,
  submitProposal, acceptProposal, getMyJobs,
} = require('../controllers/jobController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.get('/', getJobs);
router.get('/my', protect, authorize('client'), getMyJobs);
router.get('/:id', getJob);
router.post('/', protect, authorize('client'), createJob);
router.patch('/:id', protect, authorize('client'), updateJob);
router.post('/:id/proposals', protect, authorize('freelancer'), submitProposal);
router.patch('/:id/proposals/:pid/accept', protect, authorize('client'), acceptProposal);

module.exports = router;
