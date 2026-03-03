const jwt = require('jsonwebtoken');
const { safeRedisOp } = require('../config/redis');

const generateAccessToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRE || '15m' }
  );
};

const generateRefreshToken = async (userId) => {
  const token = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );

  // Store in Redis (7-day TTL). If Redis is down, token still works — just not revocable server-side
  await safeRedisOp((r) => r.setex(`refresh:${userId}`, 7 * 24 * 60 * 60, token));

  return token;
};

const verifyRefreshToken = async (userId, token) => {
  // If Redis is unavailable, fall back to JWT-only verification (less secure but functional)
  const stored = await safeRedisOp((r) => r.get(`refresh:${userId}`));
  if (stored !== null && stored !== token) return null; // Redis has a different token — reject

  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    return null;
  }
};

const revokeRefreshToken = async (userId) => {
  await safeRedisOp((r) => r.del(`refresh:${userId}`));
};

module.exports = { generateAccessToken, generateRefreshToken, verifyRefreshToken, revokeRefreshToken };
