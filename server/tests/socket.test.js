import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { io as ioClient } from 'socket.io-client';
import app from '../src/app.js';
import { initSocketServer, emitTaskCreated, emitTaskUpdated, emitTaskDeleted, emitCommentAdded } from '../src/sockets/socketHandler.js';
import { User } from '../src/models/User.js';
import { Workspace } from '../src/models/Workspace.js';
import { Membership, ROLES } from '../src/models/Membership.js';
import { signToken } from '../src/utils/token.js';

let mongoServer;
let httpServer;
let ioServer;
let serverPort;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  // Create an ephemeral HTTP & Socket.IO server for testing
  httpServer = http.createServer(app);
  ioServer = initSocketServer(httpServer);

  await new Promise((resolve) => {
    httpServer.listen(0, () => {
      serverPort = httpServer.address().port;
      resolve();
    });
  });
});

afterAll(async () => {
  if (ioServer) {
    ioServer.close();
  }
  await new Promise((resolve) => {
    httpServer.close(resolve);
  });
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Workspace.deleteMany({});
  await Membership.deleteMany({});
});

describe('Socket.IO Real-Time Collaboration & Room Authorization Tests', () => {
  let memberUser;
  let memberToken;
  let outsiderUser;
  let outsiderToken;
  let workspace;

  beforeEach(async () => {
    // 1. Create Workspace Member
    memberUser = await User.create({
      name: 'Realtime Member',
      email: 'realtime.member@example.com',
      passwordHash: '$2a$12$abcdefghijklmnopqrstuvwxyzA1B2C3D4E5F6G7H8I9J0K'
    });
    memberToken = signToken({ id: memberUser._id, email: memberUser.email });

    // 2. Create Outsider (No workspace access)
    outsiderUser = await User.create({
      name: 'Outsider User',
      email: 'outsider.socket@example.com',
      passwordHash: '$2a$12$abcdefghijklmnopqrstuvwxyzA1B2C3D4E5F6G7H8I9J0K'
    });
    outsiderToken = signToken({ id: outsiderUser._id, email: outsiderUser.email });

    // 3. Create Workspace
    workspace = await Workspace.create({
      name: 'Socket Realtime Workspace',
      slug: 'socket-realtime-workspace',
      ownerId: memberUser._id
    });

    // 4. Create Membership for memberUser
    await Membership.create({
      workspaceId: workspace._id,
      userId: memberUser._id,
      role: ROLES.ADMIN
    });
  });

  it('rejects connection when token is missing or invalid', async () => {
    const socket = ioClient(`http://localhost:${serverPort}`, {
      autoConnect: true,
      transports: ['websocket'],
      auth: { token: 'invalid.jwt.token' }
    });

    const error = await new Promise((resolve) => {
      socket.on('connect_error', (err) => {
        resolve(err);
      });
    });

    expect(error).toBeDefined();
    expect(error.message).toContain('Authentication error');
    socket.disconnect();
  });

  it('successfully authenticates and connects with valid JWT token', async () => {
    const socket = ioClient(`http://localhost:${serverPort}`, {
      autoConnect: true,
      transports: ['websocket'],
      auth: { token: memberToken }
    });

    await new Promise((resolve, reject) => {
      socket.on('connect', resolve);
      socket.on('connect_error', reject);
    });

    expect(socket.connected).toBe(true);
    socket.disconnect();
  });

  it('allows authorized workspace member to join workspace room', async () => {
    const socket = ioClient(`http://localhost:${serverPort}`, {
      autoConnect: true,
      transports: ['websocket'],
      auth: { token: memberToken }
    });

    await new Promise((resolve) => socket.on('connect', resolve));

    const response = await new Promise((resolve) => {
      socket.emit('join:workspace', { workspaceId: workspace._id.toString() }, resolve);
    });

    expect(response.success).toBe(true);
    expect(response.room).toBe(`workspace:${workspace._id}`);
    socket.disconnect();
  });

  it('forbids an outsider from joining an unauthorized workspace room', async () => {
    const socket = ioClient(`http://localhost:${serverPort}`, {
      autoConnect: true,
      transports: ['websocket'],
      auth: { token: outsiderToken }
    });

    await new Promise((resolve) => socket.on('connect', resolve));

    const response = await new Promise((resolve) => {
      socket.emit('join:workspace', { workspaceId: workspace._id.toString() }, resolve);
    });

    expect(response.success).toBe(false);
    expect(response.error).toContain('Forbidden');
    socket.disconnect();
  });

  it('broadcasts task:created and task:updated events to authorized workspace room members', async () => {
    const clientA = ioClient(`http://localhost:${serverPort}`, {
      autoConnect: true,
      transports: ['websocket'],
      auth: { token: memberToken }
    });

    await new Promise((resolve) => clientA.on('connect', resolve));

    // Client A joins workspace room
    await new Promise((resolve) => {
      clientA.emit('join:workspace', { workspaceId: workspace._id.toString() }, resolve);
    });

    // Setup listener for task:created
    const taskCreatedPromise = new Promise((resolve) => {
      clientA.on('task:created', (data) => resolve(data));
    });

    const sampleTask = {
      _id: new mongoose.Types.ObjectId().toString(),
      title: 'Real-time WebSocket Task',
      status: 'TODO',
      workspaceId: workspace._id.toString()
    };

    // Emit event from server
    emitTaskCreated(workspace._id.toString(), sampleTask);

    const receivedCreatedTask = await taskCreatedPromise;
    expect(receivedCreatedTask).toBeDefined();
    expect(receivedCreatedTask.title).toBe('Real-time WebSocket Task');

    // Setup listener for task:updated
    const taskUpdatedPromise = new Promise((resolve) => {
      clientA.on('task:updated', (data) => resolve(data));
    });

    const updatedTask = { ...sampleTask, status: 'IN_PROGRESS' };
    emitTaskUpdated(workspace._id.toString(), updatedTask);

    const receivedUpdatedTask = await taskUpdatedPromise;
    expect(receivedUpdatedTask.status).toBe('IN_PROGRESS');

    clientA.disconnect();
  });

  it('broadcasts comment:added and task:deleted events to workspace room', async () => {
    const client = ioClient(`http://localhost:${serverPort}`, {
      autoConnect: true,
      transports: ['websocket'],
      auth: { token: memberToken }
    });

    await new Promise((resolve) => client.on('connect', resolve));

    await new Promise((resolve) => {
      client.emit('join:workspace', { workspaceId: workspace._id.toString() }, resolve);
    });

    // 1. Test comment:added
    const commentPromise = new Promise((resolve) => {
      client.on('comment:added', resolve);
    });

    const sampleComment = {
      _id: new mongoose.Types.ObjectId().toString(),
      body: 'Real-time comment test',
      user: { name: memberUser.name }
    };

    emitCommentAdded(workspace._id.toString(), sampleComment);
    const receivedComment = await commentPromise;
    expect(receivedComment.body).toBe('Real-time comment test');

    // 2. Test task:deleted
    const deletedPromise = new Promise((resolve) => {
      client.on('task:deleted', resolve);
    });

    const taskId = new mongoose.Types.ObjectId().toString();
    emitTaskDeleted(workspace._id.toString(), taskId);
    const receivedDelete = await deletedPromise;
    expect(receivedDelete.taskId).toBe(taskId);

    client.disconnect();
  });
});
