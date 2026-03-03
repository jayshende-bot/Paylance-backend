const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const socketHandler = (io) => {
  // Middleware: authenticate socket connections via JWT
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    logger.info(`Socket connected: ${socket.id} (user: ${userId})`);

    // Join user's personal room for targeted notifications
    socket.join(userId);

    // Client joins contract room to get real-time milestone updates
    socket.on('join:contract', (contractId) => {
      socket.join(`contract:${contractId}`);
    });

    socket.on('leave:contract', (contractId) => {
      socket.leave(`contract:${contractId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });
};

module.exports = socketHandler;
