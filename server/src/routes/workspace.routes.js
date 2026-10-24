import { Router } from 'express';
import { workspaceController } from '../controllers/workspace.controller.js';
import { projectController } from '../controllers/project.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireWorkspaceMember, requireWorkspaceRole } from '../middleware/workspaceAuth.js';
import { validate } from '../middleware/validate.js';
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  addMemberSchema,
  updateRoleSchema
} from '../validators/workspace.validator.js';
import { createProjectSchema } from '../validators/project.validator.js';
import { ROLES } from '../models/Membership.js';

const router = Router();

// All workspace operations require an authenticated user
router.use(authenticate);

// Global user workspace listings and creation
router.post('/', validate(createWorkspaceSchema), workspaceController.createWorkspace);
router.get('/', workspaceController.getUserWorkspaces);

// Contextual workspace operations (requires active membership)
router.get(
  '/:workspaceId',
  requireWorkspaceMember,
  workspaceController.getWorkspaceById
);

router.patch(
  '/:workspaceId',
  requireWorkspaceMember,
  requireWorkspaceRole(ROLES.ADMIN),
  validate(updateWorkspaceSchema),
  workspaceController.updateWorkspace
);

// Members management
router.get(
  '/:workspaceId/members',
  requireWorkspaceMember,
  workspaceController.getMembers
);

router.post(
  '/:workspaceId/members',
  requireWorkspaceMember,
  requireWorkspaceRole(ROLES.ADMIN),
  validate(addMemberSchema),
  workspaceController.addMember
);

router.patch(
  '/:workspaceId/members/:userId',
  requireWorkspaceMember,
  requireWorkspaceRole(ROLES.ADMIN),
  validate(updateRoleSchema),
  workspaceController.updateMemberRole
);

router.delete(
  '/:workspaceId/members/:userId',
  requireWorkspaceMember,
  workspaceController.removeMember
);

// Workspace activity feed
router.get(
  '/:workspaceId/activities',
  requireWorkspaceMember,
  workspaceController.getActivities
);

// Workspace dashboard metrics
router.get(
  '/:workspaceId/dashboard',
  requireWorkspaceMember,
  workspaceController.getDashboardMetrics
);

// Workspace projects
router.post(
  '/:workspaceId/projects',
  requireWorkspaceMember,
  requireWorkspaceRole(ROLES.ADMIN, ROLES.MEMBER),
  validate(createProjectSchema),
  projectController.createProject
);

router.get(
  '/:workspaceId/projects',
  requireWorkspaceMember,
  projectController.getWorkspaceProjects
);

export default router;
