import mongoose from 'mongoose';
import { Project } from '../models/Project.js';
import { Task, TASK_STATUS } from '../models/Task.js';
import { activityService } from './activity.service.js';
import { ACTIVITY_ENTITY, ACTIVITY_ACTION } from '../models/Activity.js';
import { NotFoundError } from '../utils/errors.js';

class ProjectService {
  /**
   * Create a new project inside a workspace
   */
  async createProject(workspaceId, { name, description = '' }, createdBy) {
    const project = await Project.create({
      workspaceId,
      name: name.trim(),
      description: description.trim(),
      createdBy
    });

    await activityService.logActivity({
      workspaceId,
      actorId: createdBy,
      entityType: ACTIVITY_ENTITY.PROJECT,
      entityId: project._id,
      action: ACTIVITY_ACTION.CREATED,
      metadata: { name: project.name }
    });

    return project;
  }

  /**
   * List all active projects in a workspace with aggregated task statistics
   */
  async getWorkspaceProjects(workspaceId) {
    const projects = await Project.find({
      workspaceId,
      archivedAt: null
    })
      .populate('createdBy', 'name email avatarUrl')
      .sort({ createdAt: -1 });

    if (projects.length === 0) {
      return [];
    }

    const projectIds = projects.map(p => p._id);

    // Aggregate task stats using database aggregation pipeline
    const taskStats = await Task.aggregate([
      {
        $match: {
          projectId: { $in: projectIds }
        }
      },
      {
        $group: {
          _id: '$projectId',
          total: { $sum: 1 },
          todo: {
            $sum: { $cond: [{ $eq: ['$status', TASK_STATUS.TODO] }, 1, 0] }
          },
          inProgress: {
            $sum: { $cond: [{ $eq: ['$status', TASK_STATUS.IN_PROGRESS] }, 1, 0] }
          },
          done: {
            $sum: { $cond: [{ $eq: ['$status', TASK_STATUS.DONE] }, 1, 0] }
          }
        }
      }
    ]);

    const statsMap = taskStats.reduce((acc, curr) => {
      acc[curr._id.toString()] = {
        total: curr.total,
        todo: curr.todo,
        inProgress: curr.inProgress,
        done: curr.done,
        completionPercentage:
          curr.total > 0 ? Math.round((curr.done / curr.total) * 100) : 0
      };
      return acc;
    }, {});

    return projects.map(project => {
      const stats = statsMap[project._id.toString()] || {
        total: 0,
        todo: 0,
        inProgress: 0,
        done: 0,
        completionPercentage: 0
      };

      return {
        ...project.toJSON(),
        stats
      };
    });
  }

  /**
   * Get single project details with task counts
   */
  async getProjectById(projectId) {
    const project = await Project.findById(projectId).populate(
      'createdBy',
      'name email avatarUrl'
    );

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    const [stats] = await Task.aggregate([
      { $match: { projectId: new mongoose.Types.ObjectId(projectId) } },
      {
        $group: {
          _id: '$projectId',
          total: { $sum: 1 },
          todo: {
            $sum: { $cond: [{ $eq: ['$status', TASK_STATUS.TODO] }, 1, 0] }
          },
          inProgress: {
            $sum: { $cond: [{ $eq: ['$status', TASK_STATUS.IN_PROGRESS] }, 1, 0] }
          },
          done: {
            $sum: { $cond: [{ $eq: ['$status', TASK_STATUS.DONE] }, 1, 0] }
          }
        }
      }
    ]);

    const projectStats = stats
      ? {
          total: stats.total,
          todo: stats.todo,
          inProgress: stats.inProgress,
          done: stats.done,
          completionPercentage:
            stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0
        }
      : {
          total: 0,
          todo: 0,
          inProgress: 0,
          done: 0,
          completionPercentage: 0
        };

    return {
      ...project.toJSON(),
      stats: projectStats
    };
  }

  /**
   * Update project name or description
   */
  async updateProject(projectId, updateData, actorId) {
    const project = await Project.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project not found');
    }

    if (updateData.name) {
      project.name = updateData.name.trim();
    }
    if (updateData.description !== undefined) {
      project.description = updateData.description.trim();
    }

    await project.save();

    await activityService.logActivity({
      workspaceId: project.workspaceId,
      actorId,
      entityType: ACTIVITY_ENTITY.PROJECT,
      entityId: project._id,
      action: ACTIVITY_ACTION.UPDATED,
      metadata: updateData
    });

    return project;
  }

  /**
   * Delete or archive project
   */
  async deleteProject(projectId, actorId) {
    const project = await Project.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project not found');
    }

    const workspaceId = project.workspaceId;

    // Delete associated tasks
    await Task.deleteMany({ projectId });
    await Project.findByIdAndDelete(projectId);

    await activityService.logActivity({
      workspaceId,
      actorId,
      entityType: ACTIVITY_ENTITY.PROJECT,
      entityId: projectId,
      action: ACTIVITY_ACTION.DELETED,
      metadata: { projectName: project.name }
    });

    return true;
  }
}

export const projectService = new ProjectService();
