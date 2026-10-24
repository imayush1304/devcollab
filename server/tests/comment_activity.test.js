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
import { Comment } from '../src/models/Comment.js';
import { Activity } from '../src/models/Activity.js';

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
  await Comment.deleteMany({});
  await Activity.deleteMany({});
});

describe('Comments & Task Activity History Integration Tests', () => {
  let adminToken, adminUser;
  let memberToken, memberUser;
  let otherMemberToken, otherMemberUser;
  let viewerToken, viewerUser;
  let outsiderToken;
  let workspaceId, projectId, taskId;

  beforeEach(async () => {
    // 1. Admin
    const adminRes = await request(app).post('/api/auth/register').send({
      name: 'Admin User',
      email: 'admin@comments.test',
      password: 'Password123'
    });
    adminToken = adminRes.body.data.token;
    adminUser = adminRes.body.data.user;

    // 2. Member 1
    const memberRes = await request(app).post('/api/auth/register').send({
      name: 'Member User',
      email: 'member@comments.test',
      password: 'Password123'
    });
    memberToken = memberRes.body.data.token;
    memberUser = memberRes.body.data.user;

    // 3. Member 2
    const otherRes = await request(app).post('/api/auth/register').send({
      name: 'Other Member',
      email: 'other@comments.test',
      password: 'Password123'
    });
    otherMemberToken = otherRes.body.data.token;
    otherMemberUser = otherRes.body.data.user;

    // 4. Viewer
    const viewerRes = await request(app).post('/api/auth/register').send({
      name: 'Viewer User',
      email: 'viewer@comments.test',
      password: 'Password123'
    });
    viewerToken = viewerRes.body.data.token;
    viewerUser = viewerRes.body.data.user;

    // 5. Outsider
    const outsiderRes = await request(app).post('/api/auth/register').send({
      name: 'Outsider User',
      email: 'outsider@comments.test',
      password: 'Password123'
    });
    outsiderToken = outsiderRes.body.data.token;

    // 6. Setup Workspace & Memberships
    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Collaboration Workspace' });
    workspaceId = wsRes.body.data.workspace._id;

    await request(app)
      .post(`/api/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: memberUser.email, role: ROLES.MEMBER });

    await request(app)
      .post(`/api/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: otherMemberUser.email, role: ROLES.MEMBER });

    await request(app)
      .post(`/api/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: viewerUser.email, role: ROLES.VIEWER });

    // 7. Setup Project & Task
    const projRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/projects`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Web Services' });
    projectId = projRes.body.data._id;

    const taskRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Task with comments thread' });
    taskId = taskRes.body.data._id;
  });

  describe('POST /api/tasks/:taskId/comments', () => {
    it('allows a Member to post a comment on a task and records activity', async () => {
      const res = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ body: 'Reviewing the PR now, looks solid.' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.body).toBe('Reviewing the PR now, looks solid.');
      expect(res.body.data.authorId._id).toBe(memberUser.id);

      // Verify activity was recorded
      const activities = await Activity.find({ entityId: taskId, action: 'COMMENT_ADDED' });
      expect(activities.length).toBe(1);
    });

    it('rejects empty comment with 422 Validation Error', async () => {
      const res = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ body: '   ' });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('prevents Viewer from posting comments (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ body: 'Viewer trying to comment' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('prevents Outsider from accessing task comments (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ body: 'Outsider commenting' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /api/tasks/:taskId/comments', () => {
    beforeEach(async () => {
      await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ body: 'First comment' });

      await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ body: 'Second comment' });
    });

    it('returns task comments in chronological order', async () => {
      const res = await request(app)
        .get(`/api/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${viewerToken}`); // Viewers CAN read comments

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].body).toBe('First comment');
      expect(res.body.data[1].body).toBe('Second comment');
    });
  });

  describe('DELETE /api/tasks/:taskId/comments/:commentId', () => {
    let commentId;

    beforeEach(async () => {
      const comRes = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ body: 'Comment to be deleted' });
      commentId = comRes.body.data._id;
    });

    it('allows comment author to delete their own comment', async () => {
      const res = await request(app)
        .delete(`/api/tasks/${taskId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      const comments = await Comment.find({ taskId });
      expect(comments.length).toBe(0);
    });

    it('allows Workspace Admin to delete another user comment', async () => {
      const res = await request(app)
        .delete(`/api/tasks/${taskId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('prevents non-author Member from deleting someone else comment (403 Forbidden)', async () => {
      const res = await request(app)
        .delete(`/api/tasks/${taskId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${otherMemberToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /api/tasks/:taskId/activities', () => {
    it('returns task audit timeline events', async () => {
      const res = await request(app)
        .get(`/api/tasks/${taskId}/activities`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].entityType).toBe('TASK');
    });
  });
});
