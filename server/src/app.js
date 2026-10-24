import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { successResponse, errorResponse } from './utils/apiResponse.js';
import authRoutes from './routes/auth.routes.js';
import workspaceRoutes from './routes/workspace.routes.js';
import projectRoutes from './routes/project.routes.js';
import taskRoutes from './routes/task.routes.js';
import notificationRoutes from './routes/notification.routes.js';

const app = express();

// Trust reverse proxy (needed for secure cookies & rate-limiting on Render / Railway / Vercel)
app.set('trust proxy', 1);

// Security Headers
app.use(helmet());

// CORS Configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile/curl), matching client url, development, or Vercel deployments
      if (
        !origin ||
        origin === env.CLIENT_URL ||
        env.NODE_ENV === 'development' ||
        origin.endsWith('.vercel.app')
      ) {
        callback(null, true);
      } else {
        callback(new Error('CORS origin denied'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  })
);

// Request Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Request Logging
if (env.NODE_ENV !== 'test') {
  app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));
}

// Global API rate limiting
app.use('/api', apiLimiter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  const dbStatus = dbStates[mongoose.connection.readyState] || 'unknown';

  return successResponse(res, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    database: {
      status: dbStatus,
      connected: mongoose.connection.readyState === 1
    }
  }, 'DevCollab API is running smoothly');
});

// Root friendly welcome endpoint
app.get('/', (req, res) => {
  return successResponse(res, {
    name: 'DevCollab API',
    version: '1.0.0',
    docs: '/api/health'
  }, 'Welcome to DevCollab API');
});

// Mount Feature API Routers
app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);

// 404 Route Handler
app.use((req, res) => {
  return errorResponse(res, 404, 'NOT_FOUND', `Endpoint ${req.method} ${req.originalUrl} not found`);
});

// Centralized Error Handling Middleware
app.use(errorHandler);

export default app;
