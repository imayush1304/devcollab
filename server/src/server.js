import http from 'http';
import app from './app.js';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { logger } from './utils/logger.js';
import { initSocketServer } from './sockets/socketHandler.js';

const server = http.createServer(app);

// Initialize real-time Socket.IO server attached to HTTP server
const io = initSocketServer(server);

const startServer = async () => {
  try {
    logger.info(`Starting DevCollab backend in ${env.NODE_ENV} mode...`);

    // Connect to MongoDB Atlas
    try {
      await connectDB();
    } catch (dbError) {
      logger.warn('Initial database connection attempt failed.');
      logger.warn('The API server will still start so you can test health and routes.');
      logger.warn('Please ensure your MONGODB_URI in server/.env is valid and your IP is whitelisted on MongoDB Atlas.');
    }

    server.listen(env.PORT, () => {
      logger.info(`DevCollab server running on http://localhost:${env.PORT}`);
      logger.info(`Health check available at http://localhost:${env.PORT}/api/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const handleShutdown = async (signal) => {
  logger.info(`Received ${signal}. Gracefully shutting down DevCollab server...`);

  server.close(async () => {
    logger.info('HTTP server closed');
    try {
      await disconnectDB();
      logger.info('Database disconnected cleanly');
      process.exit(0);
    } catch (err) {
      logger.error('Error during database disconnection:', err);
      process.exit(1);
    }
  });

  // Force close after 10s if graceful shutdown hangs
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception thrown:', error);
  process.exit(1);
});

startServer();

export { server };
