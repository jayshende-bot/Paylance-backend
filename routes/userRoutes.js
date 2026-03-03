const express = require('express');
const router = express.Router();
const {
  getProfile, updateProfile, uploadAvatar,
  getNotifications, markNotificationsRead, getPublicProfile,
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../config/cloudinary');

router.get('/profile', protect, getProfile);
router.patch('/profile', protect, updateProfile);
router.post('/avatar', protect, upload.single('avatar'), uploadAvatar);
router.get('/notifications', protect, getNotifications);
router.patch('/notifications/read', protect, markNotificationsRead);
router.get('/:id', getPublicProfile);

module.exports = router;
