import { Comment } from '../models/Comment.js';
import { Task } from '../models/Task.js';
import { User } from '../models/User.js';
import { ROLES } from '../models/Membership.js';
import { activityService } from './activity.service.js';
import { notificationService } from './notification.service.js';
import { ACTIVITY_ENTITY, ACTIVITY_ACTION } from '../models/Activity.js';
import { NOTIFICATION_TYPE } from '../models/Notification.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';

class CommentService {
  /**
   * Add a comment to a task
   */
  async createComment(taskId, body, authorId) {
    const task = await Task.findById(taskId);
    if (!task) {
      throw new NotFoundError('Task not found');
    }

    const trimmedBody = body.trim();

    const comment = await Comment.create({
      taskId,
      workspaceId: task.workspaceId,
      authorId,
      body: trimmedBody
    });

    // Record audit event on the task
    const snippet = trimmedBody.length > 80 ? `${trimmedBody.substring(0, 80)}...` : trimmedBody;
    await activityService.logActivity({
      workspaceId: task.workspaceId,
      actorId: authorId,
      entityType: ACTIVITY_ENTITY.TASK,
      entityId: task._id,
      action: ACTIVITY_ACTION.COMMENT_ADDED,
      metadata: {
        taskTitle: task.title,
        commentSnippet: snippet
      }
    });

    // Notify task assignee and creator about new comment
    const author = await User.findById(authorId).select('name');
    const authorName = author?.name || 'A teammate';

    const recipients = new Set();
    if (task.assigneeId && task.assigneeId.toString() !== authorId.toString()) {
      recipients.add(task.assigneeId.toString());
    }
    if (task.createdBy && task.createdBy.toString() !== authorId.toString()) {
      recipients.add(task.createdBy.toString());
    }

    for (const recipientId of recipients) {
      await notificationService.createNotification({
        recipientId,
        workspaceId: task.workspaceId,
        type: NOTIFICATION_TYPE.TASK_COMMENT_ADDED,
        entityType: 'TASK',
        entityId: task._id,
        message: `${authorName} commented on "${task.title}": "${snippet}"`,
        metadata: { taskId: task._id, commentId: comment._id, title: task.title },
        actorId: authorId
      });
    }

    return Comment.findById(comment._id).populate(
      'authorId',
      'name email avatarUrl'
    );
  }

  /**
   * Fetch all comments for a task in chronological order
   */
  async getTaskComments(taskId) {
    return Comment.find({ taskId })
      .sort({ createdAt: 1 })
      .populate('authorId', 'name email avatarUrl');
  }

  /**
   * Delete a comment (Author or Workspace Admin only)
   */
  async deleteComment(taskId, commentId, actorId, role) {
    const comment = await Comment.findOne({ _id: commentId, taskId });
    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    const isAuthor = comment.authorId.toString() === actorId.toString();
    const isAdmin = role === ROLES.ADMIN;

    if (!isAuthor && !isAdmin) {
      throw new ForbiddenError(
        'You do not have permission to delete this comment. Only the author or workspace Admins can remove comments.'
      );
    }

    await Comment.findByIdAndDelete(commentId);
    return true;
  }
}

export const commentService = new CommentService();
