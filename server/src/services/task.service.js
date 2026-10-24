import mongoose from 'mongoose';
import { Task } from '../models/Task.js';
import { Project } from '../models/Project.js';
import { Membership } from '../models/Membership.js';
import { User } from '../models/User.js';
import { activityService } from './activity.service.js';
import { notificationService } from './notification.service.js';
import { ACTIVITY_ENTITY, ACTIVITY_ACTION } from '../models/Activity.js';
import { NOTIFICATION_TYPE } from '../models/Notification.js';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors.js';

class TaskService {
  /**
   * Create a new task within a project
   */
  async createTask(projectId, workspaceId, taskData, createdBy) {
    // 1. Verify project belongs to workspace (hierarchical integrity)
    const project = await Project.findOne({ _id: projectId, workspaceId });
    if (!project) {
      throw new BadRequestError('Project does not belong to the specified workspace');
    }

    // 2. Validate assignee eligibility if provided
    let assigneeObjectId = null;
    if (taskData.assigneeId) {
      if (!mongoose.Types.ObjectId.isValid(taskData.assigneeId)) {
        throw new BadRequestError('Invalid assignee ID format');
      }

      const isMember = await Membership.findOne({
        workspaceId,
        userId: taskData.assigneeId
      });

      if (!isMember) {
        throw new BadRequestError('Task assignee must be an active member of this workspace');
      }
      assigneeObjectId = taskData.assigneeId;
    }

    // 3. Create task document
    const task = await Task.create({
      projectId,
      workspaceId,
      title: taskData.title.trim(),
      description: taskData.description ? taskData.description.trim() : '',
      status: taskData.status,
      priority: taskData.priority,
      assigneeId: assigneeObjectId,
      createdBy,
      dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
      version: 1
    });

    // 4. Log creation audit event
    await activityService.logActivity({
      workspaceId,
      actorId: createdBy,
      entityType: ACTIVITY_ENTITY.TASK,
      entityId: task._id,
      action: ACTIVITY_ACTION.CREATED,
      metadata: { title: task.title, status: task.status, priority: task.priority }
    });

    if (assigneeObjectId) {
      await activityService.logActivity({
        workspaceId,
        actorId: createdBy,
        entityType: ACTIVITY_ENTITY.TASK,
        entityId: task._id,
        action: ACTIVITY_ACTION.ASSIGNED,
        metadata: { assigneeId: assigneeObjectId }
      });

      // Notify assignee if not the creator
      if (assigneeObjectId.toString() !== createdBy.toString()) {
        const actor = await User.findById(createdBy).select('name');
        await notificationService.createNotification({
          recipientId: assigneeObjectId,
          workspaceId,
          type: NOTIFICATION_TYPE.TASK_ASSIGNED,
          entityType: 'TASK',
          entityId: task._id,
          message: `${actor?.name || 'A teammate'} assigned you to task "${task.title}"`,
          metadata: { taskId: task._id, projectId, title: task.title },
          actorId: createdBy
        });
      }
    }

    return Task.findById(task._id)
      .populate('assigneeId', 'name email avatarUrl')
      .populate('createdBy', 'name email avatarUrl');
  }

  /**
   * List tasks for a project with search, filters, sorting, and pagination
   */
  async getProjectTasks(projectId, query = {}) {
    const filter = { projectId };

    // Status filter
    if (query.status) {
      filter.status = query.status;
    }

    // Priority filter
    if (query.priority) {
      filter.priority = query.priority;
    }

    // Assignee filter
    if (query.assigneeId) {
      if (query.assigneeId === 'unassigned') {
        filter.assigneeId = null;
      } else if (mongoose.Types.ObjectId.isValid(query.assigneeId)) {
        filter.assigneeId = query.assigneeId;
      }
    }

    // Title search
    if (query.search && query.search.trim()) {
      filter.title = { $regex: query.search.trim(), $options: 'i' };
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(query.page || '1', 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(query.limit || '50', 10)));
    const skip = (pageNum - 1) * limitNum;

    // Sorting
    const sortField = query.sortBy || 'createdAt';
    const sortDirection = query.sortOrder === 'asc' ? 1 : -1;
    const sortObj = { [sortField]: sortDirection };

    const [tasks, total] = await Promise.all([
      Task.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .populate('assigneeId', 'name email avatarUrl')
        .populate('createdBy', 'name email avatarUrl'),
      Task.countDocuments(filter)
    ]);

    return {
      tasks,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    };
  }

  /**
   * Get single task details
   */
  async getTaskById(taskId) {
    const task = await Task.findById(taskId)
      .populate('assigneeId', 'name email avatarUrl')
      .populate('createdBy', 'name email avatarUrl')
      .populate('projectId', 'name');

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    return task;
  }

  /**
   * Update task with optimistic concurrency check, validation, and audit logging
   */
  async updateTask(taskId, updateData, actorId) {
    const task = await Task.findById(taskId);
    if (!task) {
      throw new NotFoundError('Task not found');
    }

    // Optimistic Concurrency Control
    if (updateData.version !== undefined && updateData.version !== task.version) {
      throw new ConflictError(
        'This task was modified by another user. Please refresh and review before retrying.'
      );
    }

    const previousStatus = task.status;
    const previousPriority = task.priority;
    const previousAssignee = task.assigneeId ? task.assigneeId.toString() : null;
    const previousDueDate = task.dueDate;

    // Validate new assignee if changing
    if (updateData.assigneeId !== undefined) {
      if (updateData.assigneeId === null || updateData.assigneeId === '') {
        task.assigneeId = null;
      } else {
        if (!mongoose.Types.ObjectId.isValid(updateData.assigneeId)) {
          throw new BadRequestError('Invalid assignee ID format');
        }

        const isMember = await Membership.findOne({
          workspaceId: task.workspaceId,
          userId: updateData.assigneeId
        });

        if (!isMember) {
          throw new BadRequestError('Task assignee must be an active member of this workspace');
        }

        task.assigneeId = updateData.assigneeId;
      }
    }

    // Update mutable fields
    if (updateData.title) {
      task.title = updateData.title.trim();
    }
    if (updateData.description !== undefined) {
      task.description = updateData.description.trim();
    }
    if (updateData.status) {
      task.status = updateData.status;
    }
    if (updateData.priority) {
      task.priority = updateData.priority;
    }
    if (updateData.dueDate !== undefined) {
      task.dueDate = updateData.dueDate ? new Date(updateData.dueDate) : null;
    }

    // Increment version
    task.version += 1;
    await task.save();

    // Log meaningful activity events
    if (updateData.status && updateData.status !== previousStatus) {
      await activityService.logActivity({
        workspaceId: task.workspaceId,
        actorId,
        entityType: ACTIVITY_ENTITY.TASK,
        entityId: task._id,
        action: ACTIVITY_ACTION.STATUS_CHANGED,
        metadata: { from: previousStatus, to: task.status, taskTitle: task.title }
      });

      // Notify task assignee and creator about status change
      const actor = await User.findById(actorId).select('name');
      const actorName = actor?.name || 'A teammate';

      const recipients = new Set();
      if (task.assigneeId && task.assigneeId.toString() !== actorId.toString()) {
        recipients.add(task.assigneeId.toString());
      }
      if (task.createdBy && task.createdBy.toString() !== actorId.toString()) {
        recipients.add(task.createdBy.toString());
      }

      for (const recipientId of recipients) {
        await notificationService.createNotification({
          recipientId,
          workspaceId: task.workspaceId,
          type: NOTIFICATION_TYPE.TASK_STATUS_CHANGED,
          entityType: 'TASK',
          entityId: task._id,
          message: `${actorName} updated status of "${task.title}" to ${task.status}`,
          metadata: { taskId: task._id, from: previousStatus, to: task.status, title: task.title },
          actorId
        });
      }
    }

    if (updateData.priority && updateData.priority !== previousPriority) {
      await activityService.logActivity({
        workspaceId: task.workspaceId,
        actorId,
        entityType: ACTIVITY_ENTITY.TASK,
        entityId: task._id,
        action: ACTIVITY_ACTION.PRIORITY_CHANGED,
        metadata: { from: previousPriority, to: task.priority, taskTitle: task.title }
      });
    }

    const currentAssignee = task.assigneeId ? task.assigneeId.toString() : null;
    if (updateData.assigneeId !== undefined && currentAssignee !== previousAssignee) {
      await activityService.logActivity({
        workspaceId: task.workspaceId,
        actorId,
        entityType: ACTIVITY_ENTITY.TASK,
        entityId: task._id,
        action: ACTIVITY_ACTION.ASSIGNED,
        metadata: { assigneeId: task.assigneeId, taskTitle: task.title }
      });

      // Notify newly assigned user
      if (currentAssignee && currentAssignee !== actorId.toString()) {
        const actor = await User.findById(actorId).select('name');
        await notificationService.createNotification({
          recipientId: currentAssignee,
          workspaceId: task.workspaceId,
          type: NOTIFICATION_TYPE.TASK_ASSIGNED,
          entityType: 'TASK',
          entityId: task._id,
          message: `${actor?.name || 'A teammate'} assigned you to task "${task.title}"`,
          metadata: { taskId: task._id, title: task.title },
          actorId
        });
      }
    }

    if (
      updateData.dueDate !== undefined &&
      String(previousDueDate) !== String(task.dueDate)
    ) {
      await activityService.logActivity({
        workspaceId: task.workspaceId,
        actorId,
        entityType: ACTIVITY_ENTITY.TASK,
        entityId: task._id,
        action: ACTIVITY_ACTION.DUE_DATE_CHANGED,
        metadata: { dueDate: task.dueDate, taskTitle: task.title }
      });
    }

    return Task.findById(task._id)
      .populate('assigneeId', 'name email avatarUrl')
      .populate('createdBy', 'name email avatarUrl');
  }

  /**
   * Delete task
   */
  async deleteTask(taskId, actorId) {
    const task = await Task.findById(taskId);
    if (!task) {
      throw new NotFoundError('Task not found');
    }

    const workspaceId = task.workspaceId;
    const taskTitle = task.title;

    await Task.findByIdAndDelete(taskId);

    await activityService.logActivity({
      workspaceId,
      actorId,
      entityType: ACTIVITY_ENTITY.TASK,
      entityId: taskId,
      action: ACTIVITY_ACTION.DELETED,
      metadata: { taskTitle }
    });

    return true;
  }
}

export const taskService = new TaskService();
