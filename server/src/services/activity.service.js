import { Activity } from '../models/Activity.js';
import { logger } from '../utils/logger.js';

class ActivityService {
  /**
   * Log an activity record asynchronously (does not block primary operations)
   */
  async logActivity({ workspaceId, actorId, entityType, entityId, action, metadata = {} }) {
    try {
      await Activity.create({
        workspaceId,
        actorId,
        entityType,
        entityId,
        action,
        metadata
      });
    } catch (error) {
      logger.error('Failed to log workspace activity', error);
      // Non-fatal: do not abort the user transaction if activity logging encounters an error
    }
  }

  /**
   * Fetch workspace activities paginated in descending chronological order
   */
  async getWorkspaceActivities(workspaceId, { page = 1, limit = 20 } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [activities, total] = await Promise.all([
      Activity.find({ workspaceId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('actorId', 'name email avatarUrl'),
      Activity.countDocuments({ workspaceId })
    ]);

    return {
      activities,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    };
  }

  /**
   * Fetch all audit activities associated with a specific task
   */
  async getTaskActivities(taskId) {
    return Activity.find({ entityId: taskId })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('actorId', 'name email avatarUrl');
  }
}

export const activityService = new ActivityService();
