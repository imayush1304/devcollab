import api from './api';

export const taskService = {
  async getProjectTasks(projectId, query = {}) {
    const res = await api.get(`/projects/${projectId}/tasks`, { params: query });
    return res;
  },

  async createTask(projectId, data) {
    const res = await api.post(`/projects/${projectId}/tasks`, data);
    return res.data;
  },

  async getTask(taskId) {
    const res = await api.get(`/tasks/${taskId}`);
    return res.data;
  },

  async updateTask(taskId, data) {
    const res = await api.patch(`/tasks/${taskId}`, data);
    return res.data;
  },

  async deleteTask(taskId) {
    const res = await api.delete(`/tasks/${taskId}`);
    return res.data;
  }
};
