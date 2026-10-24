import api from './api';

export const workspaceService = {
  async getWorkspaces() {
    const res = await api.get('/workspaces');
    return res.data;
  },

  async createWorkspace(data) {
    const res = await api.post('/workspaces', data);
    return res.data;
  },

  async getWorkspace(workspaceId) {
    const res = await api.get(`/workspaces/${workspaceId}`);
    return res.data;
  },

  async updateWorkspace(workspaceId, data) {
    const res = await api.patch(`/workspaces/${workspaceId}`, data);
    return res.data;
  },

  async getMembers(workspaceId) {
    const res = await api.get(`/workspaces/${workspaceId}/members`);
    return res.data;
  },

  async addMember(workspaceId, { email, role }) {
    const res = await api.post(`/workspaces/${workspaceId}/members`, { email, role });
    return res.data;
  },

  async updateMemberRole(workspaceId, userId, role) {
    const res = await api.patch(`/workspaces/${workspaceId}/members/${userId}`, { role });
    return res.data;
  },

  async removeMember(workspaceId, userId) {
    const res = await api.delete(`/workspaces/${workspaceId}/members/${userId}`);
    return res.data;
  },

  async getActivities(workspaceId, query = {}) {
    const res = await api.get(`/workspaces/${workspaceId}/activities`, { params: query });
    return res;
  },

  async getDashboardMetrics(workspaceId) {
    const res = await api.get(`/workspaces/${workspaceId}/dashboard`);
    return res.data;
  }
};
