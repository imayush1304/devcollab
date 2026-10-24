import api from './api';

export const projectService = {
  async getWorkspaceProjects(workspaceId) {
    const res = await api.get(`/workspaces/${workspaceId}/projects`);
    return res.data;
  },

  async createProject(workspaceId, data) {
    const res = await api.post(`/workspaces/${workspaceId}/projects`, data);
    return res.data;
  },

  async getProject(projectId) {
    const res = await api.get(`/projects/${projectId}`);
    return res.data;
  },

  async updateProject(projectId, data) {
    const res = await api.patch(`/projects/${projectId}`, data);
    return res.data;
  },

  async deleteProject(projectId) {
    const res = await api.delete(`/projects/${projectId}`);
    return res.data;
  }
};
