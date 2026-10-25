import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Workspace } from '../src/models/Workspace.js';
import { Membership, ROLES } from '../src/models/Membership.js';
import { Project } from '../src/models/Project.js';
import { Conversation, CONVERSATION_TYPE } from '../src/models/Conversation.js';
import { Message } from '../src/models/Message.js';
import { ConversationReadState } from '../src/models/ConversationReadState.js';
import { signToken } from '../src/utils/token.js';

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await Conversation.syncIndexes();
  await Message.syncIndexes();
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
  await Conversation.deleteMany({});
  await Message.deleteMany({});
  await ConversationReadState.deleteMany({});
});

describe('DevCollab Phase 2: Conversation & Messaging REST API Tests', () => {
  let userA, tokenA;
  let userB, tokenB;
  let userC, tokenC; // Outsider
  let workspace;
  let project;

  beforeEach(async () => {
    // 1. Create Workspace Members User A and User B
    userA = await User.create({
      name: 'Alice Member',
      email: 'alice@example.com',
      passwordHash: '$2a$12$abcdefghijklmnopqrstuvwxyzA1B2C3D4E5F6G7H8I9J0K'
    });
    tokenA = signToken({ id: userA._id, email: userA.email });

    userB = await User.create({
      name: 'Bob Member',
      email: 'bob@example.com',
      passwordHash: '$2a$12$abcdefghijklmnopqrstuvwxyzA1B2C3D4E5F6G7H8I9J0K'
    });
    tokenB = signToken({ id: userB._id, email: userB.email });

    // 2. Create Outsider User C (not in workspace)
    userC = await User.create({
      name: 'Charlie Outsider',
      email: 'charlie@example.com',
      passwordHash: '$2a$12$abcdefghijklmnopqrstuvwxyzA1B2C3D4E5F6G7H8I9J0K'
    });
    tokenC = signToken({ id: userC._id, email: userC.email });

    // 3. Create Workspace and Memberships
    workspace = await Workspace.create({
      name: 'Messaging Test Workspace',
      slug: 'messaging-test-workspace',
      ownerId: userA._id
    });

    await Membership.create({
      workspaceId: workspace._id,
      userId: userA._id,
      role: ROLES.ADMIN
    });

    await Membership.create({
      workspaceId: workspace._id,
      userId: userB._id,
      role: ROLES.MEMBER
    });

    // 4. Create Project
    project = await Project.create({
      name: 'Frontend Web App',
      description: 'Core web application project',
      workspaceId: workspace._id,
      createdBy: userA._id
    });
  });

  // 1. Unauthenticated users cannot access messaging endpoints
  it('1. rejects unauthenticated access to conversation endpoints with 401', async () => {
    const resList = await request(app).get(`/api/conversations?workspaceId=${workspace._id}`);
    expect(resList.status).toBe(401);
    expect(resList.body.error.code).toBe('UNAUTHORIZED');

    const resSend = await request(app)
      .post(`/api/conversations/${new mongoose.Types.ObjectId()}/messages`)
      .send({ content: 'Hello' });
    expect(resSend.status).toBe(401);
  });

  // 2. Users cannot access conversations they do not belong to
  it('2. forbids an outsider from accessing conversations in another workspace with 403', async () => {
    // Charlie tries to list conversations in Alice & Bob's workspace
    const res = await request(app)
      .get(`/api/conversations?workspaceId=${workspace._id}`)
      .set('Authorization', `Bearer ${tokenC}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('2b. forbids an unauthorized member from accessing a private direct conversation between other members', async () => {
    // Create direct conversation between Alice (userA) and Bob (userB)
    const dmRes = await request(app)
      .post('/api/conversations/direct')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ recipientId: userB._id.toString(), workspaceId: workspace._id.toString() });

    expect(dmRes.status).toBe(201);
    const convId = dmRes.body.data._id;

    // Create a 3rd member David who IS in the workspace, but NOT part of this direct conversation
    const userD = await User.create({
      name: 'David Colleague',
      email: 'david@example.com',
      passwordHash: '$2a$12$abcdefghijklmnopqrstuvwxyzA1B2C3D4E5F6G7H8I9J0K'
    });
    await Membership.create({
      workspaceId: workspace._id,
      userId: userD._id,
      role: ROLES.MEMBER
    });
    const tokenD = signToken({ id: userD._id, email: userD.email });

    // David tries to access Alice and Bob's private DM
    const res = await request(app)
      .get(`/api/conversations/${convId}/messages`)
      .set('Authorization', `Bearer ${tokenD}`);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('not a participant');
  });

  // 4. Messages are persisted and retrieved in the correct order
  it('4. persists messages to MongoDB and retrieves them in chronological order', async () => {
    // Alice accesses project channel
    const projRes = await request(app)
      .get(`/api/conversations/project/${project._id}?workspaceId=${workspace._id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(projRes.status).toBe(200);
    const convId = projRes.body.data._id;

    // Send Message 1 from Alice
    const msg1Res = await request(app)
      .post(`/api/conversations/${convId}/messages`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ content: 'First message: Welcome to the project!' });
    expect(msg1Res.status).toBe(201);

    // Send Message 2 from Bob
    const msg2Res = await request(app)
      .post(`/api/conversations/${convId}/messages`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ content: 'Second message: Thanks Alice!' });
    expect(msg2Res.status).toBe(201);

    // Retrieve message history
    const historyRes = await request(app)
      .get(`/api/conversations/${convId}/messages`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(historyRes.status).toBe(200);
    expect(historyRes.body.data.length).toBe(2);
    expect(historyRes.body.data[0].content).toBe('First message: Welcome to the project!');
    expect(historyRes.body.data[1].content).toBe('Second message: Thanks Alice!');
    expect(historyRes.body.data[0].senderId.name).toBe('Alice Member');
    expect(historyRes.body.data[1].senderId.name).toBe('Bob Member');
  });

  // 5. Invalid and empty messages are rejected
  it('5. rejects empty, whitespace-only, and excessively long messages', async () => {
    const projRes = await request(app)
      .get(`/api/conversations/project/${project._id}?workspaceId=${workspace._id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    const convId = projRes.body.data._id;

    // Empty string
    const emptyRes = await request(app)
      .post(`/api/conversations/${convId}/messages`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ content: '' });
    expect(emptyRes.status).toBe(422);

    // Whitespace only
    const wsRes = await request(app)
      .post(`/api/conversations/${convId}/messages`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ content: '     ' });
    expect(wsRes.status).toBe(422);

    // Message exceeding 5000 characters
    const hugeContent = 'a'.repeat(5001);
    const hugeRes = await request(app)
      .post(`/api/conversations/${convId}/messages`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ content: hugeContent });
    expect(hugeRes.status).toBe(422);
  });

  // 6. Sender identity cannot be spoofed
  it('6. derives sender identity strictly from authenticated JWT and ignores spoofed client senderId', async () => {
    const projRes = await request(app)
      .get(`/api/conversations/project/${project._id}?workspaceId=${workspace._id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    const convId = projRes.body.data._id;

    // Alice sends a message attempting to spoof senderId as Bob
    const res = await request(app)
      .post(`/api/conversations/${convId}/messages`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        content: 'I claim to be Bob',
        senderId: userB._id.toString() // Spoofed payload
      });

    expect(res.status).toBe(201);
    expect(res.body.data.senderId._id.toString()).toBe(userA._id.toString());
    expect(res.body.data.senderId.name).toBe('Alice Member');
  });

  // 7. Direct conversation creation does not produce duplicates under concurrent requests
  it('7. prevents duplicate direct conversations under concurrent simultaneous requests', async () => {
    // Dispatch 5 concurrent requests simultaneously attempting to create DM between User A and User B
    const promises = Array.from({ length: 5 }).map(() =>
      request(app)
        .post('/api/conversations/direct')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          recipientId: userB._id.toString(),
          workspaceId: workspace._id.toString()
        })
    );

    const results = await Promise.all(promises);

    // All requests should succeed with status 201
    results.forEach((r) => expect(r.status).toBe(201));

    // Verify exactly ONE Conversation record was created in MongoDB
    const allDirects = await Conversation.find({
      workspaceId: workspace._id,
      type: CONVERSATION_TYPE.DIRECT
    });

    expect(allDirects.length).toBe(1);

    // Same ID returned across all concurrent responses
    const returnedIds = results.map((r) => r.body.data._id);
    expect(new Set(returnedIds).size).toBe(1);
  });

  // 8. Unread counts exclude the current user's own messages
  it('8. calculates unread counts accurately and excludes current user own messages', async () => {
    const dmRes = await request(app)
      .post('/api/conversations/direct')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        recipientId: userB._id.toString(),
        workspaceId: workspace._id.toString()
      });
    const convId = dmRes.body.data._id;

    // Alice sends 3 messages
    await request(app)
      .post(`/api/conversations/${convId}/messages`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ content: 'Msg 1 from Alice' });

    await request(app)
      .post(`/api/conversations/${convId}/messages`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ content: 'Msg 2 from Alice' });

    await request(app)
      .post(`/api/conversations/${convId}/messages`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ content: 'Msg 3 from Alice' });

    // Alice checks her unread count: should be 0 because they are HER OWN messages!
    const aliceUnreadRes = await request(app)
      .get(`/api/conversations/${convId}/unread-count`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(aliceUnreadRes.body.data.unreadCount).toBe(0);

    // Bob checks his unread count: should be 3
    const bobUnreadRes = await request(app)
      .get(`/api/conversations/${convId}/unread-count`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(bobUnreadRes.body.data.unreadCount).toBe(3);

    // Bob marks conversation as read
    const readRes = await request(app)
      .post(`/api/conversations/${convId}/read`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(readRes.status).toBe(200);

    // Bob's unread count should now be 0
    const bobUnreadAfter = await request(app)
      .get(`/api/conversations/${convId}/unread-count`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(bobUnreadAfter.body.data.unreadCount).toBe(0);
  });
});
