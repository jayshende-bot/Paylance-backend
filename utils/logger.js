const winston = require('winston');

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

// Vercel serverless has a read-only filesystem — file transports crash on startup
// Use console-only logging on Vercel; file logging on traditional servers
const isVercel = !!process.env.VERCEL;
const isDev = process.env.NODE_ENV !== 'production';

const logger = winston.createLogger({
  level: isDev ? 'debug' : 'info',
  format: combine(timestamp(), errors({ stack: true }), json()),
  defaultMeta: { service: 'paylance-api' },
  transports: [
    new winston.transports.Console({
      format: isDev ? combine(colorize(), simple()) : combine(timestamp(), json()),
    }),
    // File transports only on traditional servers (not Vercel)
    ...(!isVercel ? [
      new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
      new winston.transports.File({ filename: 'logs/combined.log' }),
    ] : []),
  ],
});

module.exports = logger;
