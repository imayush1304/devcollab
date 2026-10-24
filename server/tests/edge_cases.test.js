import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { Workspace } from '../src/models/Workspace.js';
import { Membership, ROLES } from '../src/models/Membership.js';
import { Project } from '../src/models/Project.js';
import { Task } from '../src/models/Task.js';

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

describe('Day 10: Edge-Case & Cross-Workspace Boundary Security Tests', () => {
  let user1, token1;
  let user2, token2;
  let workspace1, project1, task1;
  let workspace2, project2, task2;

  beforeEach(async () => {
    // Register User 1
    const res1 = await request(app).post('/api/auth/register').send({
      name: 'User One',
      email: 'user1@example.com',
      password: 'Password123'
    });
    token1 = res1.body.data.token;
    user1 = res1.body.data.user;

    // Register User 2
    const res2 = await request(app).post('/api/auth/register').send({
      name: 'User Two',
      email: 'user2@example.com',
      password: 'Password123'
    });
    token2 = res2.body.data.token;
    user2 = res2.body.data.user;

    // User 1 creates Workspace 1, Project 1, Task 1
    const ws1Res = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${token1}`)
      .send({ name: 'Workspace Alpha' });
    workspace1 = ws1Res.body.data.workspace;

    const proj1Res = await request(app)
      .post(`/api/workspaces/${workspace1._id}/projects`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ name: 'Alpha Project' });
    project1 = proj1Res.body.data;

    const task1Res = await request(app)
      .post(`/api/projects/${project1._id}/tasks`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ title: 'Alpha Task 1', priority: 'MEDIUM', status: 'TODO' });
    task1 = task1Res.body.data;

    // User 2 creates Workspace 2, Project 2, Task 2
    const ws2Res = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${token2}`)
      .send({ name: 'Workspace Beta' });
    workspace2 = ws2Res.body.data.workspace;

    const proj2Res = await request(app)
      .post(`/api/workspaces/${workspace2._id}/projects`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ name: 'Beta Project' });
    project2 = proj2Res.body.data;

    const task2Res = await request(app)
      .post(`/api/projects/${project2._id}/tasks`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ title: 'Beta Task 2', priority: 'HIGH', status: 'TODO' });
    task2 = task2Res.body.data;
  });

  describe('1. Security & Authentication Edge Cases', () => {
    it('rejects a forged JWT signed with an invalid secret (401 Unauthorized)', async () => {
      const forgedToken = jwt.sign(
        { id: user1.id || user1._id, email: user1.email },
        'wrong-secret-key-that-does-not-match',
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/api/workspaces')
        .set('Authorization', `Bearer ${forgedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects an expired JWT token (401 Unauthorized)', async () => {
      const expiredToken = jwt.sign(
        { id: user1.id || user1._id, email: user1.email },
        env.JWT_SECRET,
        { expiresIn: '0s' }
      );

      const res = await request(app)
        .get('/api/workspaces')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects duplicate email registrations case-insensitively (409 Conflict)', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Imposter User',
        email: 'USER1@EXAMPLE.COM', // Uppercase variation of user1@example.com
        password: 'Password123'
      });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('rejects a valid JWT containing a deleted or non-existent user ID', async () => {
      const nonExistentUserId = new mongoose.Types.ObjectId();
      const ghostToken = jwt.sign(
        { id: nonExistentUserId, email: 'ghost@example.com' },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/api/workspaces')
        .set('Authorization', `Bearer ${ghostToken}`);

      expect(res.status).toBe(401);
    });
  });

  describe('2. Cross-Workspace Data Leakage Prevention', () => {
    it('prevents User 1 from accessing Task in Workspace 2 by ID (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/tasks/${task2._id}`)
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('prevents User 1 from updating Task in Workspace 2 (403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${task2._id}`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ title: 'Hacked Title', version: 1 });

      expect(res.status).toBe(403);
    });

    it('prevents User 1 from creating a task inside Project in Workspace 2 (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/projects/${project2._id}/tasks`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ title: 'Cross Workspace Injected Task', priority: 'LOW', status: 'TODO' });

      expect(res.status).toBe(403);
    });

    it('prevents User 1 from commenting on Task in Workspace 2 (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/tasks/${task2._id}/comments`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ body: 'Unauthorized comment attempt' });

      expect(res.status).toBe(403);
    });

    it('prevents User 1 from accessing Activity Audit history of Task in Workspace 2 (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/tasks/${task2._id}/activities`)
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(403);
    });

    it('prevents User 1 from querying Project Tasks in Workspace 2 (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/projects/${project2._id}/tasks`)
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(403);
    });
  });

  describe('3. Viewer Role Boundary Enforcement across all mutations', () => {
    let viewerToken;

    beforeEach(async () => {
      // Create Viewer user and add to Workspace 1 as Viewer
      const vRes = await request(app).post('/api/auth/register').send({
        name: 'Workspace Viewer',
        email: 'viewer@example.com',
        password: 'Password123'
      });
      viewerToken = vRes.body.data.token;

      await request(app)
        .post(`/api/workspaces/${workspace1._id}/members`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ email: 'viewer@example.com', role: ROLES.VIEWER });
    });

    it('allows Viewer to read workspace projects and tasks (200 OK)', async () => {
      const projRes = await request(app)
        .get(`/api/workspaces/${workspace1._id}/projects`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(projRes.status).toBe(200);

      const taskRes = await request(app)
        .get(`/api/projects/${project1._id}/tasks`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(taskRes.status).toBe(200);
    });

    it('prevents Viewer from creating projects (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${workspace1._id}/projects`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ name: 'Viewer Project' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('prevents Viewer from creating tasks (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/projects/${project1._id}/tasks`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ title: 'Viewer Created Task', priority: 'LOW', status: 'TODO' });

      expect(res.status).toBe(403);
    });

    it('prevents Viewer from updating task status (403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${task1._id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ status: 'DONE', version: 1 });

      expect(res.status).toBe(403);
    });

    it('prevents Viewer from posting comments (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/tasks/${task1._id}/comments`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ body: 'Viewer illegal comment' });

      expect(res.status).toBe(403);
    });

    it('prevents Viewer from deleting tasks (403 Forbidden)', async () => {
      const res = await request(app)
        .delete(`/api/tasks/${task1._id}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('4. Malformed IDs and Schema Validation Edge Cases', () => {
    it('returns 400 Bad Request on invalid MongoDB ObjectId in URL params', async () => {
      const res = await request(app)
        .get('/api/tasks/not-a-valid-mongo-id')
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('Invalid task ID format');
    });

    it('returns 404 Not Found on non-existent valid ObjectId', async () => {
      const ghostTaskId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/tasks/${ghostTaskId}`)
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 422 Validation Error on malformed Zod request body', async () => {
      const res = await request(app)
        .post(`/api/projects/${project1._id}/tasks`)
        .set('Authorization', `Bearer ${token1}`)
        .send({
          title: '', // Empty title fails min(1)
          priority: 'SUPER_URGENT', // Invalid enum value
          status: 'INVALID_STATUS'
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toBeDefined();
    });
  });

  describe('5. Concurrency Race Conditions & Assignee Integrity', () => {
    it('correctly rejects conflicting concurrent task updates (Optimistic Concurrency Control)', async () => {
      // Client A and Client B both hold task1 at version 1
      // Client A updates status
      const resA = await request(app)
        .patch(`/api/tasks/${task1._id}`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ status: 'IN_PROGRESS', version: 1 });

      expect(resA.status).toBe(200);
      expect(resA.body.data.version).toBe(2);

      // Client B submits update using stale version 1
      const resB = await request(app)
        .patch(`/api/tasks/${task1._id}`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ priority: 'URGENT', version: 1 });

      expect(resB.status).toBe(409);
      expect(resB.body.error.code).toBe('CONFLICT');
      expect(resB.body.error.message).toContain('modified by another user');
    });

    it('rejects assigning a task to a user who is not a member of the workspace (400 Bad Request)', async () => {
      // User 2 is not a member of Workspace 1
      const res = await request(app)
        .post(`/api/projects/${project1._id}/tasks`)
        .set('Authorization', `Bearer ${token1}`)
        .send({
          title: 'Illegal Assignee Task',
          priority: 'MEDIUM',
          status: 'TODO',
          assigneeId: user2.id || user2._id
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('must be an active member of this workspace');
    });
  });
});
