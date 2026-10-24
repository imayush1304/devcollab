import { Notification, NOTIFICATION_TYPE } from '../models/Notification.js';
import { NotFoundError } from '../utils/errors.js';
import { emitNotification } from '../sockets/socketHandler.js';
import { logger } from '../utils/logger.js';

class NotificationService {
  /**
   * Create and persist a notification, then broadcast via Socket.IO
   */
  async createNotification({
    recipientId,
    workspaceId,
    type,
    entityType,
    entityId,
    message,
    metadata = {},
    actorId = null
  }) {
    // Avoid sending notifications to the user who triggered the action
    if (actorId && recipientId.toString() === actorId.toString()) {
      return null;
    }

    try {
      const notification = await Notification.create({
        recipientId,
        workspaceId,
        type,
        entityType,
        entityId,
        message,
        metadata
      });

      // Real-time broadcast to user's personal private socket room
      emitNotification(recipientId.toString(), notification);

      return notification;
    } catch (err) {
      logger.error('Failed to create notification:', err);
      return null;
    }
  }

  /**
   * Retrieve paginated notifications and total unread count for a user
   */
  async getUserNotifications(userId, query = {}) {
    const { workspaceId, unreadOnly, page = 1, limit = 30 } = query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));
    const skip = (pageNum - 1) * limitNum;

    const filter = { recipientId: userId };
    if (workspaceId) {
      filter.workspaceId = workspaceId;
    }
    if (unreadOnly === 'true' || unreadOnly === true) {
      filter.readAt = null;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({
        recipientId: userId,
        readAt: null,
        ...(workspaceId && { workspaceId })
      })
    ]);

    return {
      notifications,
      unreadCount,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1
      }
    };
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(notificationId, userId) {
    const notification = await Notification.findOne({
      _id: notificationId,
      recipientId: userId
    });

    if (!notification) {
      throw new NotFoundError('Notification not found or unauthorized');
    }

    if (!notification.readAt) {
      notification.readAt = new Date();
      await notification.save();
    }

    return notification;
  }

  /**
   * Mark all unread notifications as read for a user
   */
  async markAllAsRead(userId, workspaceId = null) {
    const filter = {
      recipientId: userId,
      readAt: null
    };

    if (workspaceId) {
      filter.workspaceId = workspaceId;
    }

    const result = await Notification.updateMany(filter, {
      $set: { readAt: new Date() }
    });

    return { modifiedCount: result.modifiedCount };
  }
}

export const notificationService = new NotificationService();
