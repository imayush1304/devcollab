import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Workspace } from '../src/models/Workspace.js';
import { Membership, ROLES } from '../src/models/Membership.js';
import { Project } from '../src/models/Project.js';
import { Task } from '../src/models/Task.js';
import { Notification, NOTIFICATION_TYPE } from '../src/models/Notification.js';
import { notificationService } from '../src/services/notification.service.js';

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
  await Notification.deleteMany({});
});

describe('Notification Service & In-App Alerts Integration Tests', () => {
  let userA, tokenA;
  let userB, tokenB;
  let workspace;
  let project;

  beforeEach(async () => {
    // 1. Create User A (Admin)
    const resA = await request(app).post('/api/auth/register').send({
      name: 'User A (Admin)',
      email: 'usera@example.com',
      password: 'Password123'
    });
    tokenA = resA.body.data.token;
    userA = resA.body.data.user;

    // 2. Create User B (Member)
    const resB = await request(app).post('/api/auth/register').send({
      name: 'User B (Member)',
      email: 'userb@example.com',
      password: 'Password123'
    });
    tokenB = resB.body.data.token;
    userB = resB.body.data.user;

    // 3. Create Workspace
    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Alerts Workspace' });
    workspace = wsRes.body.data.workspace;

    // 4. Add User B to Workspace
    await request(app)
      .post(`/api/workspaces/${workspace._id}/members`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ email: userB.email, role: ROLES.MEMBER });

    // 5. Create Project
    const projRes = await request(app)
      .post(`/api/workspaces/${workspace._id}/projects`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Notifications Project' });
    project = projRes.body.data;
  });

  describe('GET /api/notifications', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/notifications');
      expect(res.status).toBe(401);
    });

    it('returns notifications and unread count for authenticated user', async () => {
      // Create test notifications directly
      await notificationService.createNotification({
        recipientId: userB.id,
        workspaceId: workspace._id,
        type: NOTIFICATION_TYPE.WORKSPACE_INVITE,
        entityType: 'WORKSPACE',
        entityId: workspace._id,
        message: 'Welcome to the team!'
      });

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.meta.unreadCount).toBeGreaterThanOrEqual(1);
    });

    it('filters by unreadOnly=true correctly', async () => {
      // Clear initial workspace invite notification to test filter count cleanly
      await Notification.deleteMany({ recipientId: userB.id });

      const notif1 = await notificationService.createNotification({
        recipientId: userB.id,
        workspaceId: workspace._id,
        type: NOTIFICATION_TYPE.TASK_ASSIGNED,
        entityType: 'TASK',
        entityId: new mongoose.Types.ObjectId(),
        message: 'Task assigned'
      });

      // Mark notif1 as read
      await notificationService.markAsRead(notif1._id, userB.id);

      // Create a second unread notification
      await notificationService.createNotification({
        recipientId: userB.id,
        workspaceId: workspace._id,
        type: NOTIFICATION_TYPE.TASK_COMMENT_ADDED,
        entityType: 'TASK',
        entityId: new mongoose.Types.ObjectId(),
        message: 'New comment'
      });

      const res = await request(app)
        .get('/api/notifications?unreadOnly=true')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data.every((n) => n.readAt === null)).toBe(true);
      expect(res.body.meta.unreadCount).toBe(1);
    });
  });

  describe('PATCH /api/notifications/:notificationId/read', () => {
    it('marks a specific notification as read and sets readAt timestamp', async () => {
      const notif = await notificationService.createNotification({
        recipientId: userB.id,
        workspaceId: workspace._id,
        type: NOTIFICATION_TYPE.TASK_ASSIGNED,
        entityType: 'TASK',
        entityId: new mongoose.Types.ObjectId(),
        message: 'You have a new assignment'
      });

      const res = await request(app)
        .patch(`/api/notifications/${notif._id}/read`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.data.readAt).toBeDefined();
      expect(new Date(res.body.data.readAt)).toBeInstanceOf(Date);
    });

    it('forbids another user from marking someone else notification as read', async () => {
      const notifForB = await notificationService.createNotification({
        recipientId: userB.id,
        workspaceId: workspace._id,
        type: NOTIFICATION_TYPE.TASK_ASSIGNED,
        entityType: 'TASK',
        entityId: new mongoose.Types.ObjectId(),
        message: 'Private for B'
      });

      // User A attempts to mark User B's notification as read
      const res = await request(app)
        .patch(`/api/notifications/${notifForB._id}/read`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/notifications/read-all', () => {
    it('marks all unread notifications for the user as read', async () => {
      await notificationService.createNotification({
        recipientId: userB.id,
        workspaceId: workspace._id,
        type: NOTIFICATION_TYPE.TASK_ASSIGNED,
        entityType: 'TASK',
        entityId: new mongoose.Types.ObjectId(),
        message: 'Alert 1'
      });

      await notificationService.createNotification({
        recipientId: userB.id,
        workspaceId: workspace._id,
        type: NOTIFICATION_TYPE.TASK_COMMENT_ADDED,
        entityType: 'TASK',
        entityId: new mongoose.Types.ObjectId(),
        message: 'Alert 2'
      });

      const res = await request(app)
        .patch('/api/notifications/read-all')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.data.modifiedCount).toBeGreaterThanOrEqual(2);

      // Verify unreadCount is now 0
      const listRes = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(listRes.body.meta.unreadCount).toBe(0);
    });
  });

  describe('Automated Notification Generation on Workflow Events', () => {
    it('generates a notification for User B when User A assigns a task to User B', async () => {
      const taskRes = await request(app)
        .post(`/api/projects/${project._id}/tasks`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Automated Notification Assignment Task',
          priority: 'URGENT',
          status: 'TODO',
          assigneeId: userB.id
        });

      expect(taskRes.status).toBe(201);

      // Check User B's notifications
      const notifRes = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(notifRes.status).toBe(200);
      const assignmentAlert = notifRes.body.data.find(
        (n) => n.type === NOTIFICATION_TYPE.TASK_ASSIGNED
      );
      expect(assignmentAlert).toBeDefined();
      expect(assignmentAlert.message).toContain('Automated Notification Assignment Task');
    });

    it('generates a notification for assignee User B when User A updates task status', async () => {
      // 1. Create task assigned to User B
      const taskRes = await request(app)
        .post(`/api/projects/${project._id}/tasks`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Task for Status Update Notification',
          status: 'TODO',
          assigneeId: userB.id
        });
      const taskId = taskRes.body.data._id;

      // 2. User A updates status to IN_PROGRESS
      await request(app)
        .patch(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ status: 'IN_PROGRESS', version: 1 });

      // 3. User B checks notifications
      const notifRes = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${tokenB}`);

      const statusAlert = notifRes.body.data.find(
        (n) => n.type === NOTIFICATION_TYPE.TASK_STATUS_CHANGED
      );
      expect(statusAlert).toBeDefined();
      expect(statusAlert.message).toContain('IN_PROGRESS');
    });

    it('generates a notification for assignee User B when User A posts a comment on the task', async () => {
      // 1. Create task assigned to User B
      const taskRes = await request(app)
        .post(`/api/projects/${project._id}/tasks`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Task for Comment Notification',
          status: 'TODO',
          assigneeId: userB.id
        });
      const taskId = taskRes.body.data._id;

      // 2. User A posts a comment
      await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ body: 'Please review the security spec ASAP.' });

      // 3. User B checks notifications
      const notifRes = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${tokenB}`);

      const commentAlert = notifRes.body.data.find(
        (n) => n.type === NOTIFICATION_TYPE.TASK_COMMENT_ADDED
      );
      expect(commentAlert).toBeDefined();
      expect(commentAlert.message).toContain('security spec');
    });
  });
});
