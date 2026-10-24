import api from './api';

export const commentService = {
  async getTaskComments(taskId) {
    const res = await api.get(`/tasks/${taskId}/comments`);
    return res.data;
  },

  async createComment(taskId, body) {
    const res = await api.post(`/tasks/${taskId}/comments`, { body });
    return res.data;
  },

  async deleteComment(taskId, commentId) {
    const res = await api.delete(`/tasks/${taskId}/comments/${commentId}`);
    return res.data;
  },

  async getTaskActivities(taskId) {
    const res = await api.get(`/tasks/${taskId}/activities`);
    return res.data;
  }
};
