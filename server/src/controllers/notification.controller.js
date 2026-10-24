import { notificationService } from '../services/notification.service.js';
import { successResponse } from '../utils/apiResponse.js';

class NotificationController {
  async getUserNotifications(req, res, next) {
    try {
      const { notifications, unreadCount, meta } =
        await notificationService.getUserNotifications(req.user._id, req.query);

      return successResponse(res, notifications, 'Notifications retrieved successfully', 200, {
        unreadCount,
        ...meta
      });
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req, res, next) {
    try {
      const notification = await notificationService.markAsRead(
        req.params.notificationId,
        req.user._id
      );
      return successResponse(res, notification, 'Notification marked as read successfully');
    } catch (error) {
      next(error);
    }
  }

  async markAllAsRead(req, res, next) {
    try {
      const workspaceId = req.body?.workspaceId || req.query?.workspaceId;
      const result = await notificationService.markAllAsRead(req.user._id, workspaceId);
      return successResponse(res, result, 'All notifications marked as read successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const notificationController = new NotificationController();
