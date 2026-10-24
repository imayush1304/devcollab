import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Workspace } from '../src/models/Workspace.js';
import { Membership, ROLES } from '../src/models/Membership.js';
import { Project } from '../src/models/Project.js';
import { Task, TASK_STATUS, TASK_PRIORITY } from '../src/models/Task.js';

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Workspace.deleteMany({});
  await Membership.deleteMany({});
  await Project.deleteMany({});
  await Task.deleteMany({});
});

describe('Projects & Tasks Full Lifecycle & RBAC Tests', () => {
  let adminToken, adminUser;
  let memberToken, memberUser;
  let viewerToken, viewerUser;
  let outsiderToken;
  let workspaceId;
  let projectId;

  beforeEach(async () => {
    // 1. Setup Admin user
    const adminRes = await request(app).post('/api/auth/register').send({
      name: 'Admin User',
      email: 'admin@devcollab.io',
      password: 'Password123'
    });
    adminToken = adminRes.body.data.token;
    adminUser = adminRes.body.data.user;

    // 2. Setup Member user
    const memberRes = await request(app).post('/api/auth/register').send({
      name: 'Member User',
      email: 'member@devcollab.io',
      password: 'Password123'
    });
    memberToken = memberRes.body.data.token;
    memberUser = memberRes.body.data.user;

    // 3. Setup Viewer user
    const viewerRes = await request(app).post('/api/auth/register').send({
      name: 'Viewer User',
      email: 'viewer@devcollab.io',
      password: 'Password123'
    });
    viewerToken = viewerRes.body.data.token;
    viewerUser = viewerRes.body.data.user;

    // 4. Setup Outsider
    const outsiderRes = await request(app).post('/api/auth/register').send({
      name: 'Outsider',
      email: 'outsider@devcollab.io',
      password: 'Password123'
    });
    outsiderToken = outsiderRes.body.data.token;

    // 5. Create Workspace
    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'DevCollab Core' });
    workspaceId = wsRes.body.data.workspace._id;

    // 6. Add Member and Viewer to Workspace
    await request(app)
      .post(`/api/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: memberUser.email, role: ROLES.MEMBER });

    await request(app)
      .post(`/api/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: viewerUser.email, role: ROLES.VIEWER });

    // 7. Create Project in Workspace
    const projRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/projects`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Backend Microservices',
        description: 'Core REST APIs and architecture'
      });
    projectId = projRes.body.data._id;
  });

  describe('Project Management & RBAC', () => {
    it('allows Admin and Member to view workspace projects with aggregated metrics', async () => {
      const res = await request(app)
        .get(`/api/workspaces/${workspaceId}/projects`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Backend Microservices');
      expect(res.body.data[0].stats).toBeDefined();
      expect(res.body.data[0].stats.total).toBe(0);
    });

    it('prevents Viewer from creating projects (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/projects`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ name: 'Unauthorized Project' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('prevents Outsider from accessing workspace projects (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/workspaces/${workspaceId}/projects`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Task Operations & Assignee Validation', () => {
    it('creates a task with valid status, priority, and eligible workspace assignee', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Implement JWT refresh tokens',
          description: 'Add token rotation mechanism',
          status: TASK_STATUS.IN_PROGRESS,
          priority: TASK_PRIORITY.HIGH,
          assigneeId: memberUser.id
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Implement JWT refresh tokens');
      expect(res.body.data.status).toBe(TASK_STATUS.IN_PROGRESS);
      expect(res.body.data.priority).toBe(TASK_PRIORITY.HIGH);
      expect(res.body.data.version).toBe(1);
      expect(res.body.data.assigneeId._id).toBe(memberUser.id);
    });

    it('rejects assigning a task to a non-workspace member with 400 Bad Request', async () => {
      // Find outsider user document
      const outsider = await User.findOne({ email: 'outsider@devcollab.io' });

      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Task for outsider',
          assigneeId: outsider._id.toString()
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('must be an active member of this workspace');
    });

    it('rejects invalid task status values with 422 Validation Error', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Invalid task',
          status: 'INVALID_STATUS_VALUE'
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Task Updates & Concurrency Control', () => {
    let taskId;

    beforeEach(async () => {
      const taskRes = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Build Kanban Board UI',
          status: TASK_STATUS.TODO,
          priority: TASK_PRIORITY.MEDIUM
        });
      taskId = taskRes.body.data._id;
    });

    it('allows Member to update task status and advances version', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          status: TASK_STATUS.DONE,
          version: 1
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(TASK_STATUS.DONE);
      expect(res.body.data.version).toBe(2);
    });

    it('rejects update when version conflict occurs (Optimistic Concurrency Control)', async () => {
      // Outdated version provided (e.g. version 0 instead of current version 1)
      const res = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          status: TASK_STATUS.DONE,
          version: 99
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('modified by another user');
    });

    it('prevents Viewer from modifying tasks (403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          status: TASK_STATUS.DONE
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('supports search and status filtering on tasks', async () => {
      // Create additional tasks
      await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Write Vitest suite', status: TASK_STATUS.DONE });

      const res = await request(app)
        .get(`/api/projects/${projectId}/tasks?search=Vitest`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].title).toBe('Write Vitest suite');
    });
  });
});
