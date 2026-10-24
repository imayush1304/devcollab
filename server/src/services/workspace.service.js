import mongoose from 'mongoose';
import { Workspace } from '../models/Workspace.js';
import { Membership, ROLES } from '../models/Membership.js';
import { User } from '../models/User.js';
import { Project } from '../models/Project.js';
import { Task, TASK_STATUS, TASK_PRIORITY } from '../models/Task.js';
import { activityService } from './activity.service.js';
import { notificationService } from './notification.service.js';
import { ACTIVITY_ENTITY, ACTIVITY_ACTION } from '../models/Activity.js';
import { NOTIFICATION_TYPE } from '../models/Notification.js';
import { NotFoundError, ConflictError, ForbiddenError, BadRequestError } from '../utils/errors.js';

class WorkspaceService {
  /**
   * Helper to generate a unique URL-friendly slug
   */
  async generateUniqueSlug(name) {
    let baseSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '') || 'workspace';

    let slug = baseSlug;
    let counter = 1;

    while (await Workspace.findOne({ slug })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  /**
   * Create a new workspace and grant the creator the Admin role
   */
  async createWorkspace({ name, description = '', ownerId }) {
    const slug = await this.generateUniqueSlug(name);

    const workspace = await Workspace.create({
      name: name.trim(),
      slug,
      ownerId,
      description: description.trim()
    });

    // Create owner Admin membership
    const membership = await Membership.create({
      workspaceId: workspace._id,
      userId: ownerId,
      role: ROLES.ADMIN
    });

    // Audit log
    await activityService.logActivity({
      workspaceId: workspace._id,
      actorId: ownerId,
      entityType: ACTIVITY_ENTITY.WORKSPACE,
      entityId: workspace._id,
      action: ACTIVITY_ACTION.CREATED,
      metadata: { name: workspace.name }
    });

    return {
      workspace,
      role: membership.role
    };
  }

  /**
   * List all workspaces the current user belongs to
   */
  async getUserWorkspaces(userId) {
    const memberships = await Membership.find({ userId })
      .populate('workspaceId')
      .sort({ createdAt: -1 });

    const activeMemberships = memberships.filter(m => m.workspaceId != null);

    // Fetch member counts for each workspace
    const workspaceIds = activeMemberships.map(m => m.workspaceId._id);
    const memberCounts = await Membership.aggregate([
      { $match: { workspaceId: { $in: workspaceIds } } },
      { $group: { _id: '$workspaceId', count: { $sum: 1 } } }
    ]);

    const countMap = memberCounts.reduce((acc, curr) => {
      acc[curr._id.toString()] = curr.count;
      return acc;
    }, {});

    return activeMemberships.map(m => ({
      ...m.workspaceId.toJSON(),
      userRole: m.role,
      memberCount: countMap[m.workspaceId._id.toString()] || 1
    }));
  }

  /**
   * Get workspace details with current user's membership role
   */
  async getWorkspaceDetails(workspaceId, userId) {
    const [workspace, membership, memberCount] = await Promise.all([
      Workspace.findById(workspaceId).populate('ownerId', 'name email avatarUrl'),
      Membership.findOne({ workspaceId, userId }),
      Membership.countDocuments({ workspaceId })
    ]);

    if (!workspace) {
      throw new NotFoundError('Workspace not found');
    }

    return {
      ...workspace.toJSON(),
      currentUserRole: membership ? membership.role : null,
      memberCount
    };
  }

  /**
   * Update workspace details (Admin only)
   */
  async updateWorkspace(workspaceId, updateData, actorId) {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundError('Workspace not found');
    }

    if (updateData.name) {
      workspace.name = updateData.name.trim();
    }
    if (updateData.description !== undefined) {
      workspace.description = updateData.description.trim();
    }

    await workspace.save();

    await activityService.logActivity({
      workspaceId,
      actorId,
      entityType: ACTIVITY_ENTITY.WORKSPACE,
      entityId: workspace._id,
      action: ACTIVITY_ACTION.UPDATED,
      metadata: updateData
    });

    return workspace;
  }

  /**
   * List all members of a workspace
   */
  async getWorkspaceMembers(workspaceId) {
    const members = await Membership.find({ workspaceId })
      .populate('userId', 'name email avatarUrl')
      .sort({ createdAt: 1 });

    return members
      .filter(m => m.userId != null)
      .map(m => ({
        id: m._id,
        role: m.role,
        joinedAt: m.createdAt,
        user: {
          id: m.userId._id,
          name: m.userId.name,
          email: m.userId.email,
          avatarUrl: m.userId.avatarUrl
        }
      }));
  }

  /**
   * Add registered user to workspace by email (Admin only)
   */
  async addMember(workspaceId, { email, role = ROLES.MEMBER }, actorId) {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundError('Workspace not found');
    }

    const targetUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (!targetUser) {
      throw new NotFoundError('No registered user found with this email address');
    }

    // Check existing membership
    const existingMembership = await Membership.findOne({
      workspaceId,
      userId: targetUser._id
    });

    if (existingMembership) {
      throw new ConflictError('User is already a member of this workspace');
    }

    const membership = await Membership.create({
      workspaceId,
      userId: targetUser._id,
      role
    });

    await activityService.logActivity({
      workspaceId,
      actorId,
      entityType: ACTIVITY_ENTITY.MEMBERSHIP,
      entityId: membership._id,
      action: ACTIVITY_ACTION.MEMBER_ADDED,
      metadata: { targetUserId: targetUser._id, targetEmail: targetUser.email, role }
    });

    // Send in-app notification to the newly added member
    await notificationService.createNotification({
      recipientId: targetUser._id,
      workspaceId,
      type: NOTIFICATION_TYPE.WORKSPACE_INVITE,
      entityType: 'WORKSPACE',
      entityId: workspaceId,
      message: `You were added to workspace "${workspace.name}" with the role of ${role}`,
      metadata: { workspaceId, workspaceName: workspace.name, role },
      actorId
    });

    return {
      id: membership._id,
      role: membership.role,
      joinedAt: membership.createdAt,
      user: {
        id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        avatarUrl: targetUser.avatarUrl
      }
    };
  }

  /**
   * Change member role (Admin only, ownership safeguards)
   */
  async updateMemberRole(workspaceId, targetUserId, newRole, actorId) {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundError('Workspace not found');
    }

    // Safeguard: workspace owner cannot be demoted from Admin
    if (workspace.ownerId.toString() === targetUserId.toString() && newRole !== ROLES.ADMIN) {
      throw new ForbiddenError('The workspace owner cannot be demoted from the Admin role');
    }

    const membership = await Membership.findOne({
      workspaceId,
      userId: targetUserId
    }).populate('userId', 'name email avatarUrl');

    if (!membership) {
      throw new NotFoundError('Member record not found');
    }

    membership.role = newRole;
    await membership.save();

    await activityService.logActivity({
      workspaceId,
      actorId,
      entityType: ACTIVITY_ENTITY.MEMBERSHIP,
      entityId: membership._id,
      action: ACTIVITY_ACTION.ROLE_CHANGED,
      metadata: { targetUserId, newRole }
    });

    // Notify member about role update
    await notificationService.createNotification({
      recipientId: targetUserId,
      workspaceId,
      type: NOTIFICATION_TYPE.ROLE_UPDATED,
      entityType: 'WORKSPACE',
      entityId: workspaceId,
      message: `Your role in workspace "${workspace.name}" was updated to ${newRole}`,
      metadata: { workspaceId, newRole },
      actorId
    });

    return {
      id: membership._id,
      role: membership.role,
      user: {
        id: membership.userId._id,
        name: membership.userId.name,
        email: membership.userId.email
      }
    };
  }

  /**
   * Remove member or allow user to leave workspace
   */
  async removeMember(workspaceId, targetUserId, actorId) {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundError('Workspace not found');
    }

    // Safeguard: workspace owner cannot be removed or leave
    if (workspace.ownerId.toString() === targetUserId.toString()) {
      throw new ForbiddenError('The workspace owner cannot be removed or leave the workspace');
    }

    const membership = await Membership.findOneAndDelete({
      workspaceId,
      userId: targetUserId
    });

    if (!membership) {
      throw new NotFoundError('Member record not found');
    }

    await activityService.logActivity({
      workspaceId,
      actorId,
      entityType: ACTIVITY_ENTITY.MEMBERSHIP,
      entityId: membership._id,
      action: ACTIVITY_ACTION.MEMBER_REMOVED,
      metadata: { targetUserId }
    });

    return true;
  }

  /**
   * Aggregate metrics for workspace dashboard (Projects count, Task breakdowns, Overdue tasks)
   */
  async getWorkspaceDashboardMetrics(workspaceId, userId) {
    const wsObjectId = new mongoose.Types.ObjectId(workspaceId);
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const now = new Date();

    const [totalProjects, taskAggregation, recentTasks] = await Promise.all([
      Project.countDocuments({ workspaceId, archivedAt: null }),
      Task.aggregate([
        { $match: { workspaceId: wsObjectId } },
        {
          $facet: {
            totalTasks: [{ $count: 'count' }],
            byStatus: [
              { $group: { _id: '$status', count: { $sum: 1 } } }
            ],
            byPriority: [
              { $group: { _id: '$priority', count: { $sum: 1 } } }
            ],
            assignedToMe: [
              { $match: { assigneeId: userObjectId } },
              { $count: 'count' }
            ],
            overdueTasks: [
              {
                $match: {
                  dueDate: { $lt: now, $ne: null },
                  status: { $ne: TASK_STATUS.DONE }
                }
              },
              { $count: 'count' }
            ]
          }
        }
      ]),
      Task.find({ workspaceId })
        .sort({ updatedAt: -1 })
        .limit(6)
        .populate('assigneeId', 'name email avatarUrl')
        .populate('projectId', 'name')
    ]);

    const facet = taskAggregation[0] || {};
    const totalTasks = facet.totalTasks?.[0]?.count || 0;
    const assignedToMe = facet.assignedToMe?.[0]?.count || 0;
    const overdueTasks = facet.overdueTasks?.[0]?.count || 0;

    const statusCounts = {
      [TASK_STATUS.TODO]: 0,
      [TASK_STATUS.IN_PROGRESS]: 0,
      [TASK_STATUS.DONE]: 0
    };
    (facet.byStatus || []).forEach(item => {
      if (item._id) statusCounts[item._id] = item.count;
    });

    const priorityCounts = {
      [TASK_PRIORITY.LOW]: 0,
      [TASK_PRIORITY.MEDIUM]: 0,
      [TASK_PRIORITY.HIGH]: 0,
      [TASK_PRIORITY.URGENT]: 0
    };
    (facet.byPriority || []).forEach(item => {
      if (item._id) priorityCounts[item._id] = item.count;
    });

    return {
      totalProjects,
      totalTasks,
      assignedToMe,
      overdueTasks,
      tasksByStatus: statusCounts,
      tasksByPriority: priorityCounts,
      recentlyUpdatedTasks: recentTasks
    };
  }
}

export const workspaceService = new WorkspaceService();
