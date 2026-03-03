const Redis = require('ioredis');
const logger = require('../utils/logger');

let redis;
let connectionFailed = false;

const connectRedis = () => {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    // Stop retrying after 3 attempts — log once, not every second
    retryStrategy: (times) => {
      if (times >= 3) {
        if (!connectionFailed) {
          connectionFailed = true;
          logger.warn('Redis unavailable — refresh tokens & caching disabled. Install Redis or set REDIS_URL in .env');
        }
        return null; // stop retrying
      }
      return Math.min(times * 200, 1000);
    },
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: true,
  });

  redis.on('connect', () => {
    connectionFailed = false;
    logger.info('Redis connected');
  });
  redis.on('error', () => {}); // suppress repeated error logs (retryStrategy handles messaging)

  redis.connect().catch(() => {}); // non-blocking connect
  return redis;
};

const getRedis = () => {
  if (!redis) connectRedis();
  return redis;
};

// Safe wrapper — returns null instead of throwing if Redis is down
const safeRedisOp = async (fn) => {
  try {
    if (connectionFailed) return null;
    return await fn(getRedis());
  } catch {
    return null;
  }
};

module.exports = { connectRedis, getRedis, safeRedisOp };
