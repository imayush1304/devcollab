import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Workspace } from '../src/models/Workspace.js';
import { Membership, ROLES } from '../src/models/Membership.js';

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
});

describe('Workspace & Membership APIs & Authorization Tests', () => {
  let ownerToken;
  let ownerUser;
  let secondUserToken;
  let secondUser;
  let outsiderToken;
  let outsiderUser;

  beforeEach(async () => {
    // 1. Create Workspace Owner
    const ownerRes = await request(app).post('/api/auth/register').send({
      name: 'Workspace Owner',
      email: 'owner@example.com',
      password: 'Password123'
    });
    ownerToken = ownerRes.body.data.token;
    ownerUser = ownerRes.body.data.user;

    // 2. Create Second Registered User (to become Member / Viewer)
    const secondRes = await request(app).post('/api/auth/register').send({
      name: 'Second User',
      email: 'second@example.com',
      password: 'Password123'
    });
    secondUserToken = secondRes.body.data.token;
    secondUser = secondRes.body.data.user;

    // 3. Create Outsider User (never added to the workspace)
    const outsiderRes = await request(app).post('/api/auth/register').send({
      name: 'Outsider User',
      email: 'outsider@example.com',
      password: 'Password123'
    });
    outsiderToken = outsiderRes.body.data.token;
    outsiderUser = outsiderRes.body.data.user;
  });

  describe('POST /api/workspaces', () => {
    it('creates a workspace and makes creator the Admin owner', async () => {
      const res = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Engineering Hub',
          description: 'DevCollab engineering workspace'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.workspace.name).toBe('Engineering Hub');
      expect(res.body.data.workspace.slug).toBe('engineering-hub');
      expect(res.body.data.role).toBe(ROLES.ADMIN);

      // Verify membership record in DB
      const membership = await Membership.findOne({
        workspaceId: res.body.data.workspace._id,
        userId: ownerUser.id
      });
      expect(membership).not.toBeNull();
      expect(membership.role).toBe(ROLES.ADMIN);
    });
  });

  describe('GET /api/workspaces and GET /api/workspaces/:workspaceId', () => {
    let workspaceId;

    beforeEach(async () => {
      const wsRes = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Alpha Workspace' });
      workspaceId = wsRes.body.data.workspace._id;
    });

    it('returns authorized workspaces in list', async () => {
      const res = await request(app)
        .get('/api/workspaces')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Alpha Workspace');
      expect(res.body.data[0].userRole).toBe(ROLES.ADMIN);
    });

    it('allows a workspace member to view workspace details', async () => {
      const res = await request(app)
        .get(`/api/workspaces/${workspaceId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Alpha Workspace');
      expect(res.body.data.currentUserRole).toBe(ROLES.ADMIN);
    });

    it('rejects an outsider user with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/workspaces/${workspaceId}`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Membership and Role Management', () => {
    let workspaceId;

    beforeEach(async () => {
      const wsRes = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Delta Workspace' });
      workspaceId = wsRes.body.data.workspace._id;
    });

    it('Admin can add a registered user to the workspace', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: secondUser.email,
          role: ROLES.MEMBER
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(secondUser.email);
      expect(res.body.data.role).toBe(ROLES.MEMBER);
    });

    it('rejects adding duplicate membership with 409 Conflict', async () => {
      // First add
      await request(app)
        .post(`/api/workspaces/${workspaceId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: secondUser.email, role: ROLES.MEMBER });

      // Duplicate attempt
      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: secondUser.email, role: ROLES.MEMBER });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('Member cannot add other members (403 Forbidden)', async () => {
      // Add secondUser as Member
      await request(app)
        .post(`/api/workspaces/${workspaceId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: secondUser.email, role: ROLES.MEMBER });

      // Member attempts to add outsider
      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/members`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send({ email: outsiderUser.email, role: ROLES.MEMBER });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Admin can update member role from Member to Viewer', async () => {
      // Add as Member
      await request(app)
        .post(`/api/workspaces/${workspaceId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: secondUser.email, role: ROLES.MEMBER });

      // Update to Viewer
      const res = await request(app)
        .patch(`/api/workspaces/${workspaceId}/members/${secondUser.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ role: ROLES.VIEWER });

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe(ROLES.VIEWER);
    });

    it('prevents demotion of the workspace owner', async () => {
      const res = await request(app)
        .patch(`/api/workspaces/${workspaceId}/members/${ownerUser.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ role: ROLES.VIEWER });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('owner cannot be demoted');
    });

    it('prevents removal of the workspace owner', async () => {
      const res = await request(app)
        .delete(`/api/workspaces/${workspaceId}/members/${ownerUser.id}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('owner cannot be removed');
    });
  });
});
