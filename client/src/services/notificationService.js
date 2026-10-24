import api from './api';

export const notificationService = {
  /**
   * Get user's notifications with optional unreadOnly and workspace filters
   */
  async getNotifications(params = {}) {
    return api.get('/notifications', { params });
  },

  /**
   * Mark a single notification as read
   */
  async markAsRead(notificationId) {
    return api.patch(`/notifications/${notificationId}/read`);
  },

  /**
   * Mark all unread notifications as read
   */
  async markAllAsRead(workspaceId = null) {
    return api.patch('/notifications/read-all', { workspaceId });
  }
};
