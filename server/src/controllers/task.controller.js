import { taskService } from '../services/task.service.js';
import { successResponse } from '../utils/apiResponse.js';
import { ROLES } from '../models/Membership.js';
import { ForbiddenError } from '../utils/errors.js';
import { emitTaskCreated, emitTaskUpdated, emitTaskDeleted } from '../sockets/socketHandler.js';

class TaskController {
  async createTask(req, res, next) {
    try {
      const task = await taskService.createTask(
        req.params.projectId,
        req.workspace._id,
        req.body,
        req.user._id
      );
      // Real-time broadcast to all workspace collaborators
      emitTaskCreated(task.workspaceId || req.workspace._id, task);
      return successResponse(res, task, 'Task created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async getProjectTasks(req, res, next) {
    try {
      const { tasks, meta } = await taskService.getProjectTasks(
        req.params.projectId,
        req.query
      );
      return successResponse(res, tasks, 'Tasks retrieved successfully', 200, meta);
    } catch (error) {
      next(error);
    }
  }

  async getTaskById(req, res, next) {
    try {
      const task = await taskService.getTaskById(req.params.taskId);
      return successResponse(res, task, 'Task retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateTask(req, res, next) {
    try {
      const task = await taskService.updateTask(
        req.params.taskId,
        req.body,
        req.user._id
      );
      // Real-time broadcast to all workspace collaborators
      emitTaskUpdated(task.workspaceId || req.workspace?._id, task);
      return successResponse(res, task, 'Task updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteTask(req, res, next) {
    try {
      const isAdmin = req.membership.role === ROLES.ADMIN;
      const isCreator = req.task.createdBy.toString() === req.user._id.toString();

      if (!isAdmin && !isCreator) {
        throw new ForbiddenError(
          'Only workspace Admins or the task creator have permission to delete this task'
        );
      }

      const workspaceId = req.task.workspaceId || req.workspace?._id;
      await taskService.deleteTask(req.params.taskId, req.user._id);
      // Real-time broadcast to all workspace collaborators
      emitTaskDeleted(workspaceId, req.params.taskId);
      return successResponse(res, null, 'Task deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const taskController = new TaskController();
