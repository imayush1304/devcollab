import { workspaceService } from '../services/workspace.service.js';
import { activityService } from '../services/activity.service.js';
import { successResponse } from '../utils/apiResponse.js';
import { ROLES } from '../models/Membership.js';
import { ForbiddenError } from '../utils/errors.js';

class WorkspaceController {
  async createWorkspace(req, res, next) {
    try {
      const data = await workspaceService.createWorkspace({
        ...req.body,
        ownerId: req.user._id
      });
      return successResponse(res, data, 'Workspace created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async getUserWorkspaces(req, res, next) {
    try {
      const workspaces = await workspaceService.getUserWorkspaces(req.user._id);
      return successResponse(res, workspaces, 'Workspaces retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getWorkspaceById(req, res, next) {
    try {
      const workspace = await workspaceService.getWorkspaceDetails(
        req.params.workspaceId,
        req.user._id
      );
      return successResponse(res, workspace, 'Workspace details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateWorkspace(req, res, next) {
    try {
      const workspace = await workspaceService.updateWorkspace(
        req.params.workspaceId,
        req.body,
        req.user._id
      );
      return successResponse(res, workspace, 'Workspace updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async getMembers(req, res, next) {
    try {
      const members = await workspaceService.getWorkspaceMembers(req.params.workspaceId);
      return successResponse(res, members, 'Workspace members retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async addMember(req, res, next) {
    try {
      const member = await workspaceService.addMember(
        req.params.workspaceId,
        req.body,
        req.user._id
      );
      return successResponse(res, member, 'Member added to workspace successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async updateMemberRole(req, res, next) {
    try {
      const updated = await workspaceService.updateMemberRole(
        req.params.workspaceId,
        req.params.userId,
        req.body.role,
        req.user._id
      );
      return successResponse(res, updated, 'Member role updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async removeMember(req, res, next) {
    try {
      const isSelf = req.params.userId === req.user._id.toString();
      const isAdmin = req.membership.role === ROLES.ADMIN;

      // Only an Admin can remove other members; a user can remove themselves (leave)
      if (!isSelf && !isAdmin) {
        throw new ForbiddenError('Only workspace Admins can remove other members');
      }

      await workspaceService.removeMember(
        req.params.workspaceId,
        req.params.userId,
        req.user._id
      );

      return successResponse(
        res,
        null,
        isSelf ? 'You have left the workspace' : 'Member removed successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  async getActivities(req, res, next) {
    try {
      const { activities, meta } = await activityService.getWorkspaceActivities(
        req.params.workspaceId,
        req.query
      );
      return successResponse(
        res,
        activities,
        'Workspace activities retrieved successfully',
        200,
        meta
      );
    } catch (error) {
      next(error);
    }
  }

  async getDashboardMetrics(req, res, next) {
    try {
      const metrics = await workspaceService.getWorkspaceDashboardMetrics(
        req.params.workspaceId,
        req.user._id
      );
      return successResponse(
        res,
        metrics,
        'Workspace dashboard metrics retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }
}

export const workspaceController = new WorkspaceController();
