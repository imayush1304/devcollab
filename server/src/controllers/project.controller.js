import { projectService } from '../services/project.service.js';
import { successResponse } from '../utils/apiResponse.js';

class ProjectController {
  async createProject(req, res, next) {
    try {
      const project = await projectService.createProject(
        req.params.workspaceId,
        req.body,
        req.user._id
      );
      return successResponse(res, project, 'Project created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async getWorkspaceProjects(req, res, next) {
    try {
      const projects = await projectService.getWorkspaceProjects(req.params.workspaceId);
      return successResponse(res, projects, 'Workspace projects retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getProjectById(req, res, next) {
    try {
      const project = await projectService.getProjectById(req.params.projectId);
      return successResponse(res, project, 'Project details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateProject(req, res, next) {
    try {
      const project = await projectService.updateProject(
        req.params.projectId,
        req.body,
        req.user._id
      );
      return successResponse(res, project, 'Project updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteProject(req, res, next) {
    try {
      await projectService.deleteProject(req.params.projectId, req.user._id);
      return successResponse(res, null, 'Project deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const projectController = new ProjectController();
