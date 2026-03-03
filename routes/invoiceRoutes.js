const express = require('express');
const router = express.Router();
const { getInvoice } = require('../controllers/invoiceController');
const { protect } = require('../middleware/authMiddleware');

router.get('/:milestoneId', protect, getInvoice);

module.exports = router;
