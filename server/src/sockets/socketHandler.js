import { Server } from 'socket.io';
import { socketAuthMiddleware } from './socketAuth.js';
import { Membership } from '../models/Membership.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let io = null;

export const initSocketServer = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (
          !origin ||
          origin === env.CLIENT_URL ||
          env.NODE_ENV === 'development' ||
          origin.endsWith('.vercel.app')
        ) {
          callback(null, true);
        } else {
          callback(new Error('CORS origin denied for Socket.IO'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST']
    },
    pingTimeout: 30000,
    pingInterval: 25000
  });

  // Attach authentication guard
  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} (User: ${socket.user?.name} [${socket.user?._id}])`);

    // Auto-join user-specific private room for direct notifications
    const userRoom = `user:${socket.user._id}`;
    socket.join(userRoom);

    // Client requests to join a workspace room
    socket.on('join:workspace', async ({ workspaceId }, callback) => {
      try {
        if (!workspaceId) {
          if (callback) callback({ success: false, error: 'Workspace ID required' });
          return;
        }

        // Verify active workspace membership before granting room entry
        const isMember = await Membership.findOne({
          workspaceId,
          userId: socket.user._id
        });

        if (!isMember) {
          logger.warn(
            `User ${socket.user.email} attempted to join unauthorized workspace room: ${workspaceId}`
          );
          if (callback) {
            callback({
              success: false,
              error: 'Forbidden: You are not a member of this workspace'
            });
          }
          return;
        }

        const room = `workspace:${workspaceId}`;
        socket.join(room);
        logger.info(`User ${socket.user.email} joined real-time room: ${room}`);

        if (callback) callback({ success: true, room });
      } catch (err) {
        logger.error('Error in join:workspace socket handler:', err);
        if (callback) callback({ success: false, error: 'Internal server error' });
      }
    });

    // Client requests to leave a workspace room
    socket.on('leave:workspace', ({ workspaceId }) => {
      if (workspaceId) {
        const room = `workspace:${workspaceId}`;
        socket.leave(room);
        logger.info(`User ${socket.user.email} left real-time room: ${room}`);
      }
    });

    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} (Reason: ${reason})`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    logger.warn('Socket.IO not initialized yet');
  }
  return io;
};

// ==========================================
// Workspace Real-time Event Broadcasters
// ==========================================

export const emitTaskCreated = (workspaceId, task) => {
  if (io && workspaceId) {
    io.to(`workspace:${workspaceId}`).emit('task:created', task);
  }
};

export const emitTaskUpdated = (workspaceId, task) => {
  if (io && workspaceId) {
    io.to(`workspace:${workspaceId}`).emit('task:updated', task);
  }
};

export const emitTaskDeleted = (workspaceId, taskId) => {
  if (io && workspaceId) {
    io.to(`workspace:${workspaceId}`).emit('task:deleted', { taskId });
  }
};

export const emitCommentAdded = (workspaceId, comment) => {
  if (io && workspaceId) {
    io.to(`workspace:${workspaceId}`).emit('comment:added', comment);
  }
};

export const emitNotification = (recipientId, notification) => {
  if (io && recipientId) {
    io.to(`user:${recipientId}`).emit('notification:created', notification);
  }
};
