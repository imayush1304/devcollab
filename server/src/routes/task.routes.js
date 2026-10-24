import { Router } from 'express';
import { taskController } from '../controllers/task.controller.js';
import { commentController } from '../controllers/comment.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireWorkspaceMember, requireWorkspaceRole } from '../middleware/workspaceAuth.js';
import { validate } from '../middleware/validate.js';
import { updateTaskSchema } from '../validators/task.validator.js';
import { createCommentSchema } from '../validators/comment.validator.js';
import { ROLES } from '../models/Membership.js';

const router = Router();

router.use(authenticate);

// Direct task operations
router.get(
  '/:taskId',
  requireWorkspaceMember,
  taskController.getTaskById
);

router.patch(
  '/:taskId',
  requireWorkspaceMember,
  requireWorkspaceRole(ROLES.ADMIN, ROLES.MEMBER),
  validate(updateTaskSchema),
  taskController.updateTask
);

router.delete(
  '/:taskId',
  requireWorkspaceMember,
  taskController.deleteTask
);

// Task comments endpoints
router.get(
  '/:taskId/comments',
  requireWorkspaceMember,
  commentController.getTaskComments
);

router.post(
  '/:taskId/comments',
  requireWorkspaceMember,
  requireWorkspaceRole(ROLES.ADMIN, ROLES.MEMBER),
  validate(createCommentSchema),
  commentController.createComment
);

router.delete(
  '/:taskId/comments/:commentId',
  requireWorkspaceMember,
  commentController.deleteComment
);

// Task activity audit history
router.get(
  '/:taskId/activities',
  requireWorkspaceMember,
  commentController.getTaskActivities
);

export default router;
