const express = require('express');
const router = express.Router();
const { getContracts, getContract } = require('../controllers/contractController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getContracts);
router.get('/:id', protect, getContract);

module.exports = router;
