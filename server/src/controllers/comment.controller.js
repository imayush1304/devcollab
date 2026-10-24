import { commentService } from '../services/comment.service.js';
import { activityService } from '../services/activity.service.js';
import { successResponse } from '../utils/apiResponse.js';
import { emitCommentAdded } from '../sockets/socketHandler.js';

class CommentController {
  async createComment(req, res, next) {
    try {
      const comment = await commentService.createComment(
        req.params.taskId,
        req.body.body,
        req.user._id
      );
      const workspaceId = req.task?.workspaceId || req.workspace?._id;
      emitCommentAdded(workspaceId, comment);
      return successResponse(res, comment, 'Comment added successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async getTaskComments(req, res, next) {
    try {
      const comments = await commentService.getTaskComments(req.params.taskId);
      return successResponse(res, comments, 'Comments retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteComment(req, res, next) {
    try {
      await commentService.deleteComment(
        req.params.taskId,
        req.params.commentId,
        req.user._id,
        req.membership.role
      );
      return successResponse(res, null, 'Comment deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async getTaskActivities(req, res, next) {
    try {
      const activities = await activityService.getTaskActivities(req.params.taskId);
      return successResponse(res, activities, 'Task activities retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const commentController = new CommentController();
