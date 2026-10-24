import mongoose from 'mongoose';
import { Workspace } from '../models/Workspace.js';
import { Membership, ROLES } from '../models/Membership.js';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { ForbiddenError, NotFoundError, BadRequestError } from '../utils/errors.js';

/**
 * Middleware ensuring current authenticated user is an active member of the workspace.
 * Resolves workspaceId from req.params.workspaceId, req.params.projectId, or req.params.taskId.
 */
export const requireWorkspaceMember = async (req, res, next) => {
  try {
    let workspaceId = req.params.workspaceId;

    // Resolve via Project if workspaceId not directly in params
    if (!workspaceId && req.params.projectId) {
      if (!mongoose.Types.ObjectId.isValid(req.params.projectId)) {
        throw new BadRequestError('Invalid project ID format');
      }
      const project = await Project.findById(req.params.projectId);
      if (!project) {
        throw new NotFoundError('Project not found');
      }
      req.project = project;
      workspaceId = project.workspaceId.toString();
    }

    // Resolve via Task if workspaceId not directly in params
    if (!workspaceId && req.params.taskId) {
      if (!mongoose.Types.ObjectId.isValid(req.params.taskId)) {
        throw new BadRequestError('Invalid task ID format');
      }
      const task = await Task.findById(req.params.taskId);
      if (!task) {
        throw new NotFoundError('Task not found');
      }
      req.task = task;
      workspaceId = task.workspaceId.toString();
    }

    if (!workspaceId) {
      throw new BadRequestError('Workspace ID context is required');
    }

    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      throw new BadRequestError('Invalid workspace ID format');
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundError('Workspace not found');
    }

    // Verify user membership
    const membership = await Membership.findOne({
      workspaceId,
      userId: req.user._id
    });

    if (!membership) {
      throw new ForbiddenError('You are not a member of this workspace');
    }

    // Attach contextual entities to request object
    req.workspace = workspace;
    req.membership = membership;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Role-based access control middleware for workspace resources.
 * Usage: requireRole(ROLES.ADMIN) or requireRole(ROLES.ADMIN, ROLES.MEMBER)
 */
export const requireWorkspaceRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.membership) {
      return next(new ForbiddenError('Workspace membership context not established'));
    }

    if (!allowedRoles.includes(req.membership.role)) {
      return next(
        new ForbiddenError(
          `Insufficient permissions. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.membership.role}`
        )
      );
    }

    next();
  };
};
