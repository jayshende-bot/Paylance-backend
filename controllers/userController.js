const User = require('../models/User');
const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { cloudinary } = require('../config/cloudinary');

// GET /api/v1/users/profile
const getProfile = async (req, res, next) => {
  try {
    res.json(new ApiResponse(200, { user: req.user }));
  } catch (err) {
    next(err);
  }
};

// PATCH /api/v1/users/profile
const updateProfile = async (req, res, next) => {
  try {
    const allowed = ['name', 'bio', 'skills', 'hourlyRate', 'location'];
    const updates = {};
    allowed.forEach((key) => { if (req.body[key] !== undefined) updates[key] = req.body[key]; });

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    res.json(new ApiResponse(200, { user }, 'Profile updated'));
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/users/avatar (upload via Cloudinary)
const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) throw new ApiError(400, 'No file uploaded');

    // req.file.path contains the Cloudinary URL when using CloudinaryStorage
    const avatarUrl = req.file.path;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: avatarUrl },
      { new: true }
    );

    res.json(new ApiResponse(200, { avatar: user.avatar }, 'Avatar updated'));
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/users/notifications
const getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ recipient: req.user._id })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      Notification.countDocuments({ recipient: req.user._id }),
      Notification.countDocuments({ recipient: req.user._id, isRead: false }),
    ]);

    res.json(new ApiResponse(200, { notifications, total, unreadCount, page: Number(page) }));
  } catch (err) {
    next(err);
  }
};

// PATCH /api/v1/users/notifications/read
const markNotificationsRead = async (req, res, next) => {
  try {
    const { ids } = req.body; // array of notification IDs, or empty for all
    const filter = { recipient: req.user._id };
    if (ids?.length) filter._id = { $in: ids };

    await Notification.updateMany(filter, { isRead: true });
    res.json(new ApiResponse(200, null, 'Notifications marked as read'));
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/users/:id (public profile)
const getPublicProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('name avatar bio skills hourlyRate location role createdAt');
    if (!user) throw new ApiError(404, 'User not found');
    res.json(new ApiResponse(200, { user }));
  } catch (err) {
    next(err);
  }
};

module.exports = { getProfile, updateProfile, uploadAvatar, getNotifications, markNotificationsRead, getPublicProfile };
