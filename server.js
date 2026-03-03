require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const connectDB = require('./config/db');
const { connectRedis } = require('./config/redis');
const logger = require('./utils/logger');
const { globalLimiter } = require('./middleware/rateLimitMiddleware');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');
const socketHandler = require('./socket/socketHandler');
const notificationService = require('./services/notificationService');

// ── Route imports ─────────────────────────────────────────────────────────────
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const jobRoutes = require('./routes/jobRoutes');
const milestoneRoutes = require('./routes/milestoneRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const stripeConnectRoutes = require('./routes/stripeConnectRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const webhookRoutes = require('./routes/webhookRoutes');   // raw body — must be first!
const contractRoutes = require('./routes/contractRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

const app = express();
const server = http.createServer(app);

// ── Socket.io (disabled on Vercel serverless — no persistent connections) ─────
if (!process.env.VERCEL) {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    },
  });
  socketHandler(io);
  notificationService.init(io);
}

// ── Security & Logging ────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(globalLimiter);

// ── IMPORTANT: Webhook route BEFORE express.json() ───────────────────────────
// Stripe needs the raw request body for signature verification
app.use('/api/v1/webhook', webhookRoutes);

// ── Body Parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── API Routes ────────────────────────────────────────────────────────────────
const API = '/api/v1';
app.use(`${API}/auth`, authRoutes);
app.use(`${API}/users`, userRoutes);
app.use(`${API}/jobs`, jobRoutes);
app.use(`${API}/contracts`, contractRoutes);
app.use(`${API}/milestones`, milestoneRoutes);
app.use(`${API}/payment`, paymentRoutes);
app.use(`${API}/connect`, stripeConnectRoutes);
app.use(`${API}/subscriptions`, subscriptionRoutes);
app.use(`${API}/invoices`, invoiceRoutes);
app.use(`${API}/analytics`, analyticsRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date().toISOString() }));

// ── Error Handling ────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start: local dev vs Vercel serverless ─────────────────────────────────────
if (process.env.VERCEL) {
  // Vercel: connect DB + Redis at module load, export app as serverless handler
  connectDB().catch((err) => logger.error(`DB connect failed: ${err.message}`));
  connectRedis();
  module.exports = app;
} else {
  // Local / Render: bind to a port
  const PORT = process.env.PORT || 5000;
  const start = async () => {
    try {
      await connectDB();
      connectRedis();
      server.listen(PORT, () => {
        logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
        logger.info(`API: http://localhost:${PORT}/api/v1`);
      });
    } catch (err) {
      logger.error(`Failed to start server: ${err.message}`);
      process.exit(1);
    }
  };
  start();

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    server.close(() => process.exit(0));
  });
}
