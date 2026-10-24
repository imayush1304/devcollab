import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

let isConnected = false;

export const connectDB = async () => {
  if (isConnected) {
    logger.info('MongoDB connection already established');
    return;
  }

  try {
    const conn = await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 8000, // Timeout after 8 seconds instead of hanging
    });

    isConnected = true;
    logger.info(`MongoDB Connected successfully to host: ${conn.connection.host}`);
    logger.info(`Target Database: ${conn.connection.name}`);
  } catch (error) {
    logger.error(`MongoDB Connection Error: ${error.message}`);
    // If running in development with an unconfigured Atlas URI, provide helpful troubleshooting guidance
    if (env.MONGODB_URI.includes('username:password@cluster0')) {
      logger.warn('NOTICE: You are using the default placeholder MONGODB_URI in server/.env.');
      logger.warn('Please update server/.env with your actual MongoDB Atlas connection string.');
    }
    throw error;
  }
};

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
  isConnected = false;
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection runtime error', err);
});

export const disconnectDB = async () => {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  logger.info('MongoDB connection closed');
};
