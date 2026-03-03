const { safeRedisOp } = require('../config/redis');

const DEFAULT_TTL = 300; // 5 minutes

const get = async (key) => {
  const data = await safeRedisOp((r) => r.get(key));
  return data ? JSON.parse(data) : null;
};

const set = async (key, value, ttl = DEFAULT_TTL) => {
  await safeRedisOp((r) => r.setex(key, ttl, JSON.stringify(value)));
};

const del = async (key) => {
  await safeRedisOp((r) => r.del(key));
};

const delPattern = async (pattern) => {
  const keys = await safeRedisOp((r) => r.keys(pattern));
  if (keys?.length > 0) await safeRedisOp((r) => r.del(...keys));
};

// If Redis is down, withCache just always calls fetchFn (no caching, correct data)
const withCache = async (key, fetchFn, ttl = DEFAULT_TTL) => {
  const cached = await get(key);
  if (cached) return cached;

  const data = await fetchFn();
  await set(key, data, ttl);
  return data;
};

module.exports = { get, set, del, delPattern, withCache };
