import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { io as ioClient } from 'socket.io-client';
import app from '../src/app.js';
import { initSocketServer, isUserOnline } from '../src/sockets/socketHandler.js';
import { User } from '../src/models/User.js';
import { Workspace } from '../src/models/Workspace.js';
import { Membership, ROLES } from '../src/models/Membership.js';
import { Project } from '../src/models/Project.js';
import { Conversation, CONVERSATION_TYPE } from '../src/models/Conversation.js';
import { Message } from '../src/models/Message.js';
import { ConversationService } from '../src/services/conversation.service.js';
import { signToken } from '../src/utils/token.js';

let mongoServer;
let httpServer;
let ioServer;
let serverPort;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await Conversation.syncIndexes();
  await Message.syncIndexes();

  // Create ephemeral HTTP & Socket.IO server for testing
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
  await Project.deleteMany({});
  await Conversation.deleteMany({});
  await Message.deleteMany({});
});

describe('DevCollab Phase 2: Socket.IO Real-Time Messaging & Presence Tests', () => {
  let userA, tokenA;
  let userB, tokenB;
  let userC, tokenC; // Outsider
  let workspace;
  let project;
  let projectConversation;
  let directConversation;

  beforeEach(async () => {
    // 1. Create Users
    userA = await User.create({
      name: 'Alice Realtime',
      email: 'alice.realtime@example.com',
      passwordHash: '$2a$12$abcdefghijklmnopqrstuvwxyzA1B2C3D4E5F6G7H8I9J0K'
    });
    tokenA = signToken({ id: userA._id, email: userA.email });

    userB = await User.create({
      name: 'Bob Realtime',
      email: 'bob.realtime@example.com',
      passwordHash: '$2a$12$abcdefghijklmnopqrstuvwxyzA1B2C3D4E5F6G7H8I9J0K'
    });
    tokenB = signToken({ id: userB._id, email: userB.email });

    userC = await User.create({
      name: 'Charlie Realtime Outsider',
      email: 'charlie.realtime@example.com',
      passwordHash: '$2a$12$abcdefghijklmnopqrstuvwxyzA1B2C3D4E5F6G7H8I9J0K'
    });
    tokenC = signToken({ id: userC._id, email: userC.email });

    // 2. Create Workspace and Memberships
    workspace = await Workspace.create({
      name: 'Socket Realtime Messaging WS',
      slug: 'socket-realtime-messaging-ws',
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

    // 3. Create Project & Project Channel
    project = await Project.create({
      name: 'Backend Micro-Services Project',
      workspaceId: workspace._id,
      createdBy: userA._id
    });

    projectConversation = await ConversationService.getOrCreateProjectConversation(
      workspace._id,
      project._id,
      userA._id
    );

    // 4. Create Direct Conversation between Alice and Bob
    directConversation = await ConversationService.getOrCreateDirectConversation(
      userA._id,
      userB._id,
      workspace._id
    );
  });

  // 3. Users cannot join unauthorized Socket.IO rooms
  it('3. rejects outsider from joining an unauthorized conversation room', async () => {
    const outsiderSocket = ioClient(`http://localhost:${serverPort}`, {
      autoConnect: true,
      transports: ['websocket'],
      auth: { token: tokenC }
    });

    await new Promise((resolve) => outsiderSocket.on('connect', resolve));

    // Charlie tries to join Alice and Bob's project channel room
    const response = await new Promise((resolve) => {
      outsiderSocket.emit(
        'conversation:join',
        { conversationId: projectConversation._id.toString() },
        resolve
      );
    });

    expect(response.success).toBe(false);
    expect(response.error).toContain('not a member of this workspace');

    outsiderSocket.disconnect();
  });

  it('3b. allows authorized participant to join conversation room successfully', async () => {
    const memberSocket = ioClient(`http://localhost:${serverPort}`, {
      autoConnect: true,
      transports: ['websocket'],
      auth: { token: tokenA }
    });

    await new Promise((resolve) => memberSocket.on('connect', resolve));

    const response = await new Promise((resolve) => {
      memberSocket.emit(
        'conversation:join',
        { conversationId: projectConversation._id.toString() },
        resolve
      );
    });

    expect(response.success).toBe(true);
    expect(response.conversationId).toBe(projectConversation._id.toString());
    expect(response.room).toBe(`conversation:${projectConversation._id}`);

    memberSocket.disconnect();
  });

  // 9. Presence works correctly with multiple simultaneous connections
  it('9. tracks multi-connection presence accurately and keeps user online if one of multiple tabs disconnects', async () => {
    // Connect Tab 1 for Alice
    const socketTab1 = ioClient(`http://localhost:${serverPort}`, {
      autoConnect: true,
      transports: ['websocket'],
      auth: { token: tokenA }
    });
    await new Promise((resolve) => socketTab1.on('connect', resolve));

    // Connect Tab 2 for Alice (e.g. second browser tab)
    const socketTab2 = ioClient(`http://localhost:${serverPort}`, {
      autoConnect: true,
      transports: ['websocket'],
      auth: { token: tokenA }
    });
    await new Promise((resolve) => socketTab2.on('connect', resolve));

    expect(isUserOnline(userA._id)).toBe(true);

    // Disconnect Tab 1: User Alice should STILL be online because Tab 2 remains active!
    socketTab1.disconnect();
    await new Promise((r) => setTimeout(r, 100));

    expect(isUserOnline(userA._id)).toBe(true);

    // Now disconnect Tab 2: Now Alice should be marked offline
    socketTab2.disconnect();
    await new Promise((r) => setTimeout(r, 100));

    expect(isUserOnline(userA._id)).toBe(false);
  });

  // Real-time message exchange & non-echo broadcast
  it('11. delivers real-time message to other room members without duplicate echo to sender', async () => {
    // Client Alice (Sender)
    const clientAlice = ioClient(`http://localhost:${serverPort}`, {
      autoConnect: true,
      transports: ['websocket'],
      auth: { token: tokenA }
    });
    await new Promise((resolve) => clientAlice.on('connect', resolve));

    // Client Bob (Receiver)
    const clientBob = ioClient(`http://localhost:${serverPort}`, {
      autoConnect: true,
      transports: ['websocket'],
      auth: { token: tokenB }
    });
    await new Promise((resolve) => clientBob.on('connect', resolve));

    // Both join conversation room
    const convId = directConversation._id.toString();
    await new Promise((res) => clientAlice.emit('conversation:join', { conversationId: convId }, res));
    await new Promise((res) => clientBob.emit('conversation:join', { conversationId: convId }, res));

    // Setup listener for Bob
    let bobReceivedMessage = null;
    clientBob.on('message:new', (msg) => {
      bobReceivedMessage = msg;
    });

    // Sender listener (to verify NO echo is broadcast back to sender)
    let aliceReceivedEcho = false;
    clientAlice.on('message:new', () => {
      aliceReceivedEcho = true;
    });

    // Alice sends message with tempId
    const sendAck = await new Promise((resolve) => {
      clientAlice.emit(
        'message:send',
        {
          conversationId: convId,
          content: 'Hello Bob! This is real-time delivery.',
          tempId: 'temp_client_123'
        },
        resolve
      );
    });

    // Verify Sender acknowledgement
    expect(sendAck.success).toBe(true);
    expect(sendAck.tempId).toBe('temp_client_123');
    expect(sendAck.message.content).toBe('Hello Bob! This is real-time delivery.');
    expect(sendAck.message.senderId.name).toBe('Alice Realtime');

    // Wait a brief tick for socket broadcast
    await new Promise((r) => setTimeout(r, 200));

    // Receiver received the real-time event
    expect(bobReceivedMessage).toBeDefined();
    expect(bobReceivedMessage.content).toBe('Hello Bob! This is real-time delivery.');
    expect(bobReceivedMessage.conversationId).toBe(convId);

    // Sender did NOT receive an echo broadcast
    expect(aliceReceivedEcho).toBe(false);

    // Verify message was stored in MongoDB
    const persistedMsg = await Message.findById(sendAck.message._id);
    expect(persistedMsg).toBeDefined();
    expect(persistedMsg.content).toBe('Hello Bob! This is real-time delivery.');

    clientAlice.disconnect();
    clientBob.disconnect();
  });

  // 10. Disconnected clients can reconnect and load persisted messages
  it('10. allows disconnected client to reconnect and load messages persisted during disconnection', async () => {
    const convId = projectConversation._id.toString();

    // 1. Persist messages while Bob is offline
    await ConversationService.createMessage(convId, userA._id, 'Message while Bob is offline #1');
    await ConversationService.createMessage(convId, userA._id, 'Message while Bob is offline #2');

    // 2. Bob connects after the fact
    const clientBob = ioClient(`http://localhost:${serverPort}`, {
      autoConnect: true,
      transports: ['websocket'],
      auth: { token: tokenB }
    });
    await new Promise((resolve) => clientBob.on('connect', resolve));

    // Bob joins room and loads messages
    const joinRes = await new Promise((resolve) => {
      clientBob.emit('conversation:join', { conversationId: convId }, resolve);
    });
    expect(joinRes.success).toBe(true);

    const history = await ConversationService.getMessages(convId, userB._id);
    expect(history.messages.length).toBe(2);
    expect(history.messages[0].content).toBe('Message while Bob is offline #1');
    expect(history.messages[1].content).toBe('Message while Bob is offline #2');

    clientBob.disconnect();
  });
});
