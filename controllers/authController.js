const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
} = require('../utils/generateToken');
const stripeService = require('../services/stripeService');
const emailService = require('../services/emailService');

// POST /api/v1/auth/register
const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    const exists = await User.findOne({ email });
    if (exists) throw new ApiError(400, 'Email already registered');

    // Create Stripe customer for every user
    const customer = await stripeService.createCustomer(email, name, 'pending');

    const user = await User.create({
      name, email, password, role,
      stripeCustomerId: customer.id,
    });

    // Update Stripe metadata with real userId
    await stripeService.createCustomer; // already created above

    emailService.sendWelcome(user).catch(() => {});

    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = await generateRefreshToken(user._id);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json(new ApiResponse(201, { user, accessToken }, 'Registration successful'));
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) throw new ApiError(401, 'Invalid email or password');

    const isMatch = await user.matchPassword(password);
    if (!isMatch) throw new ApiError(401, 'Invalid email or password');

    if (!user.isActive) throw new ApiError(403, 'Account has been deactivated');

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = await generateRefreshToken(user._id);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const { password: _, ...userData } = user.toObject();
    res.json(new ApiResponse(200, { user: userData, accessToken }, 'Login successful'));
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/auth/refresh
const refresh = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) throw new ApiError(401, 'No refresh token');

    const decoded = await verifyRefreshToken(null, token);
    if (!decoded) throw new ApiError(401, 'Invalid or expired refresh token');

    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) throw new ApiError(401, 'User not found');

    const accessToken = generateAccessToken(user._id, user.role);
    res.json(new ApiResponse(200, { accessToken }, 'Token refreshed'));
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/auth/logout
const logout = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
        await revokeRefreshToken(decoded.userId);
      } catch {}
    }

    res.clearCookie('refreshToken');
    res.json(new ApiResponse(200, null, 'Logged out successfully'));
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/auth/me
const getMe = async (req, res, next) => {
  try {
    res.json(new ApiResponse(200, { user: req.user }));
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, refresh, logout, getMe };
