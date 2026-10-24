import { Router } from 'express';
import { projectController } from '../controllers/project.controller.js';
import { taskController } from '../controllers/task.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireWorkspaceMember, requireWorkspaceRole } from '../middleware/workspaceAuth.js';
import { validate } from '../middleware/validate.js';
import { updateProjectSchema } from '../validators/project.validator.js';
import { createTaskSchema, taskQuerySchema } from '../validators/task.validator.js';
import { ROLES } from '../models/Membership.js';

const router = Router();

router.use(authenticate);

// Project-level direct operations
router.get(
  '/:projectId',
  requireWorkspaceMember,
  projectController.getProjectById
);

router.patch(
  '/:projectId',
  requireWorkspaceMember,
  requireWorkspaceRole(ROLES.ADMIN, ROLES.MEMBER),
  validate(updateProjectSchema),
  projectController.updateProject
);

router.delete(
  '/:projectId',
  requireWorkspaceMember,
  requireWorkspaceRole(ROLES.ADMIN),
  projectController.deleteProject
);

// Tasks scoped to a project
router.post(
  '/:projectId/tasks',
  requireWorkspaceMember,
  requireWorkspaceRole(ROLES.ADMIN, ROLES.MEMBER),
  validate(createTaskSchema),
  taskController.createTask
);

router.get(
  '/:projectId/tasks',
  requireWorkspaceMember,
  validate(taskQuerySchema, 'query'),
  taskController.getProjectTasks
);

export default router;
