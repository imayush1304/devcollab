import { Server } from 'socket.io';
import { socketAuthMiddleware } from './socketAuth.js';
import { Membership } from '../models/Membership.js';
import { ConversationService } from '../services/conversation.service.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let io = null;

// ============================================================================
// Ephemeral Multi-Connection Presence Registry (Single Backend Instance)
// Note: In a multi-server scaled deployment, a Redis adapter would manage presence.
// ============================================================================

// Maps userId (string) -> Set of active socket IDs (supports multiple tabs/devices)
const userSockets = new Map();
// Maps userId (string) -> Set of workspace IDs (string)
const userWorkspaces = new Map();

export const getOnlineUsersInWorkspace = (workspaceId) => {
  const onlineUserIds = [];
  const wsId = workspaceId.toString();

  for (const [userId, wsSet] of userWorkspaces.entries()) {
    if (wsSet.has(wsId)) {
      const sockets = userSockets.get(userId);
      if (sockets && sockets.size > 0) {
        onlineUserIds.push(userId);
      }
    }
  }
  return onlineUserIds;
};

export const isUserOnline = (userId) => {
  const sockets = userSockets.get(userId.toString());
  return Boolean(sockets && sockets.size > 0);
};

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

  // Attach authentication guard (verifies JWT token from handshake auth/headers/cookies)
  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    const userEmail = socket.user.email;

    logger.info(`Socket connected: ${socket.id} (User: ${socket.user?.name} [${userId}])`);

    // 1. Presence Registry: Record active socket for this user
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    const wasOffline = userSockets.get(userId).size === 0;
    userSockets.get(userId).add(socket.id);

    if (!userWorkspaces.has(userId)) {
      userWorkspaces.set(userId, new Set());
    }

    // Auto-join user-specific private room for direct personal notifications and sync
    const userRoom = `user:${userId}`;
    socket.join(userRoom);

    // ==========================================
    // Workspace Room & Presence Handlers
    // ==========================================

    socket.on('join:workspace', async ({ workspaceId }, callback) => {
      try {
        if (!workspaceId) {
          if (callback) callback({ success: false, error: 'Workspace ID required' });
          return;
        }

        const wsId = workspaceId.toString();

        // Verify active workspace membership before granting room entry
        const isMember = await Membership.findOne({
          workspaceId: wsId,
          userId: socket.user._id
        });

        if (!isMember) {
          logger.warn(
            `User ${userEmail} attempted to join unauthorized workspace room: ${wsId}`
          );
          if (callback) {
            callback({
              success: false,
              error: 'Forbidden: You are not a member of this workspace'
            });
          }
          return;
        }

        const room = `workspace:${wsId}`;
        socket.join(room);
        userWorkspaces.get(userId).add(wsId);

        logger.info(`User ${userEmail} joined real-time room: ${room}`);

        // Broadcast presence update to workspace room members if this user just came online
        if (wasOffline || userSockets.get(userId).size === 1) {
          socket.to(room).emit('presence:updated', {
            userId,
            status: 'online'
          });
        }

        // Return room info + list of currently online members in this workspace
        if (callback) {
          callback({
            success: true,
            room,
            onlineUserIds: getOnlineUsersInWorkspace(wsId)
          });
        }
      } catch (err) {
        logger.error('Error in join:workspace socket handler:', err);
        if (callback) callback({ success: false, error: 'Internal server error' });
      }
    });

    socket.on('leave:workspace', ({ workspaceId }) => {
      if (workspaceId) {
        const wsId = workspaceId.toString();
        const room = `workspace:${wsId}`;
        socket.leave(room);
        if (userWorkspaces.has(userId)) {
          userWorkspaces.get(userId).delete(wsId);
        }
        logger.info(`User ${userEmail} left real-time room: ${room}`);
      }
    });

    socket.on('presence:get', ({ workspaceId }, callback) => {
      if (workspaceId && callback) {
        callback({
          success: true,
          onlineUserIds: getOnlineUsersInWorkspace(workspaceId)
        });
      }
    });

    // ==========================================
    // Real-Time Conversation Room Handlers
    // ==========================================

    // Join conversation room with strict access verification
    socket.on('conversation:join', async ({ conversationId }, callback) => {
      try {
        if (!conversationId) {
          if (callback) callback({ success: false, error: 'Conversation ID required' });
          return;
        }

        // Strictly verify authorization (workspace member and participant if direct)
        await ConversationService.verifyConversationAccess(
          conversationId,
          socket.user._id
        );

        const room = `conversation:${conversationId}`;
        socket.join(room);
        logger.info(`User ${userEmail} joined conversation room: ${room}`);

        if (callback) {
          callback({ success: true, conversationId, room });
        }
      } catch (err) {
        logger.warn(
          `User ${userEmail} unauthorized or failed to join conversation ${conversationId}: ${err.message}`
        );
        if (callback) {
          callback({ success: false, error: err.message });
        }
      }
    });

    // Leave conversation room
    socket.on('conversation:leave', ({ conversationId }, callback) => {
      if (conversationId) {
        const room = `conversation:${conversationId}`;
        socket.leave(room);
        logger.info(`User ${userEmail} left conversation room: ${room}`);
        if (callback) callback({ success: true, conversationId });
      }
    });

    // Send persistent real-time message
    socket.on('message:send', async ({ conversationId, content, tempId }, callback) => {
      try {
        if (!conversationId || !content || !content.trim()) {
          const errMessage = 'Conversation ID and non-empty content are required';
          socket.emit('message:error', { error: errMessage, tempId });
          if (callback) callback({ success: false, error: errMessage, tempId });
          return;
        }

        // Persist message to MongoDB and update conversation meta
        const result = await ConversationService.createMessage(
          conversationId,
          socket.user._id,
          content
        );

        const room = `conversation:${conversationId}`;

        // Broadcast to other participants in this conversation (excludes sender to prevent duplicate echo)
        socket.to(room).emit('message:new', result.message);

        // Broadcast conversation snippet update to workspace sidebar
        io.to(`workspace:${result.workspaceId}`).emit('conversation:updated', {
          conversationId,
          lastMessageAt: result.message.createdAt,
          lastMessage: {
            content: result.message.content.substring(0, 120),
            senderId: socket.user._id,
            createdAt: result.message.createdAt
          }
        });

        // Acknowledge sender with persisted message and reconciliation tempId
        if (callback) {
          callback({
            success: true,
            message: result.message,
            tempId
          });
        }
      } catch (err) {
        logger.error(`Error in message:send handler: ${err.message}`);
        socket.emit('message:error', { error: err.message, tempId });
        if (callback) {
          callback({ success: false, error: err.message, tempId });
        }
      }
    });

    // Mark conversation read in real time
    socket.on('conversation:read', async ({ conversationId }, callback) => {
      try {
        if (!conversationId) return;

        const res = await ConversationService.markConversationRead(
          conversationId,
          socket.user._id
        );

        // Notify user's other connected tabs to clear unread counter
        io.to(userRoom).emit('conversation:unread-updated', {
          conversationId,
          unreadCount: 0
        });

        if (callback) {
          callback({ success: true, conversationId, lastReadAt: res.lastReadAt });
        }
      } catch (err) {
        logger.error(`Error in conversation:read handler: ${err.message}`);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ==========================================
    // Disconnect & Multi-Connection Cleanup
    // ==========================================

    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} (Reason: ${reason})`);

      if (userSockets.has(userId)) {
        const userSocketSet = userSockets.get(userId);
        userSocketSet.delete(socket.id);

        // Only mark user as offline when ALL their active connections have closed
        if (userSocketSet.size === 0) {
          userSockets.delete(userId);

          // Broadcast offline status to all workspaces this user was present in
          const workspaces = userWorkspaces.get(userId);
          if (workspaces && workspaces.size > 0) {
            for (const wsId of workspaces) {
              io.to(`workspace:${wsId}`).emit('presence:updated', {
                userId,
                status: 'offline'
              });
            }
          }
          userWorkspaces.delete(userId);
          logger.info(`User ${userEmail} is now fully offline.`);
        } else {
          logger.info(
            `User ${userEmail} still has ${userSocketSet.size} active connection(s).`
          );
        }
      }
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
