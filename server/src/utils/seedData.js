import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Workspace } from '../models/Workspace.js';
import { Membership, ROLES } from '../models/Membership.js';
import { Project } from '../models/Project.js';
import { Task, TASK_STATUS, TASK_PRIORITY } from '../models/Task.js';
import { Activity, ACTIVITY_ENTITY, ACTIVITY_ACTION } from '../models/Activity.js';
import { logger } from './logger.js';

const seedDatabase = async () => {
  try {
    await connectDB();
    logger.info('Connected to MongoDB Atlas. Seeding data for DevCollab...');

    // 1. Clean existing seed data to prevent duplicates
    await Promise.all([
      User.deleteMany({ email: { $in: ['ayush@example.com', 'sarah.dev@example.com', 'alex.viewer@example.com'] } }),
      Workspace.deleteMany({ slug: 'devcollab-engineering' })
    ]);

    // 2. Create Users
    logger.info('Creating demo users...');
    const passwordHash = await User.hashPassword('Password123');

    const adminUser = await User.create({
      name: 'Ayush Sharma',
      email: 'ayush@example.com',
      passwordHash,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop'
    });

    const memberUser = await User.create({
      name: 'Sarah Chen',
      email: 'sarah.dev@example.com',
      passwordHash,
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop'
    });

    const viewerUser = await User.create({
      name: 'Alex Rivera',
      email: 'alex.viewer@example.com',
      passwordHash,
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop'
    });

    // 3. Create Workspace
    logger.info('Creating workspace...');
    const workspace = await Workspace.create({
      name: 'DevCollab Engineering',
      slug: 'devcollab-engineering',
      ownerId: adminUser._id,
      description: 'Primary engineering workspace for software teams building DevCollab SaaS'
    });

    // 4. Create Memberships with distinct roles
    logger.info('Creating memberships with RBAC roles...');
    await Membership.create([
      {
        workspaceId: workspace._id,
        userId: adminUser._id,
        role: ROLES.ADMIN
      },
      {
        workspaceId: workspace._id,
        userId: memberUser._id,
        role: ROLES.MEMBER
      },
      {
        workspaceId: workspace._id,
        userId: viewerUser._id,
        role: ROLES.VIEWER
      }
    ]);

    // 5. Create Projects
    logger.info('Creating projects...');
    const backendProject = await Project.create({
      workspaceId: workspace._id,
      name: 'Core API & Cloud Backend',
      description: 'REST API, JWT security, Mongoose schemas, and MongoDB Atlas integration',
      createdBy: adminUser._id
    });

    const frontendProject = await Project.create({
      workspaceId: workspace._id,
      name: 'Kanban Frontend Client',
      description: 'React, Vite, Tailwind CSS, and drag-and-drop Kanban interface',
      createdBy: memberUser._id
    });

    // 6. Create Tasks across different Kanban columns & priorities
    logger.info('Creating tasks...');
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const tasks = await Task.create([
      {
        projectId: backendProject._id,
        workspaceId: workspace._id,
        title: 'Design JWT & HttpOnly Cookie Authentication',
        description: 'Implement stateless JWT signing, verification, and cookie security.',
        status: TASK_STATUS.DONE,
        priority: TASK_PRIORITY.HIGH,
        assigneeId: adminUser._id,
        createdBy: adminUser._id,
        dueDate: tomorrow,
        version: 1
      },
      {
        projectId: backendProject._id,
        workspaceId: workspace._id,
        title: 'Implement RBAC & Workspace Membership Gatekeeper',
        description: 'Zero-trust authorization for Admin, Member, and Viewer roles.',
        status: TASK_STATUS.DONE,
        priority: TASK_PRIORITY.URGENT,
        assigneeId: adminUser._id,
        createdBy: adminUser._id,
        dueDate: tomorrow,
        version: 1
      },
      {
        projectId: backendProject._id,
        workspaceId: workspace._id,
        title: 'Set up Database Aggregation Pipelines for Metrics',
        description: 'Compute project task counts and completion rates in MongoDB.',
        status: TASK_STATUS.DONE,
        priority: TASK_PRIORITY.MEDIUM,
        assigneeId: memberUser._id,
        createdBy: adminUser._id,
        dueDate: nextWeek,
        version: 1
      },
      {
        projectId: frontendProject._id,
        workspaceId: workspace._id,
        title: 'Build Drag-and-Drop Kanban Board with @dnd-kit',
        description: 'Create smooth drag-and-drop column transitions between To Do, In Progress, and Done.',
        status: TASK_STATUS.IN_PROGRESS,
        priority: TASK_PRIORITY.HIGH,
        assigneeId: memberUser._id,
        createdBy: adminUser._id,
        dueDate: nextWeek,
        version: 1
      },
      {
        projectId: frontendProject._id,
        workspaceId: workspace._id,
        title: 'Real-time WebSocket Notifications with Socket.IO',
        description: 'Broadcast task updates to workspace rooms with optimistic UI rollbacks.',
        status: TASK_STATUS.TODO,
        priority: TASK_PRIORITY.MEDIUM,
        assigneeId: null, // Unassigned
        createdBy: adminUser._id,
        dueDate: nextWeek,
        version: 1
      }
    ]);

    // 7. Create Activities (Audit History)
    logger.info('Logging audit activities...');
    await Activity.create([
      {
        workspaceId: workspace._id,
        actorId: adminUser._id,
        entityType: ACTIVITY_ENTITY.WORKSPACE,
        entityId: workspace._id,
        action: ACTIVITY_ACTION.CREATED,
        metadata: { name: workspace.name }
      },
      {
        workspaceId: workspace._id,
        actorId: adminUser._id,
        entityType: ACTIVITY_ENTITY.MEMBERSHIP,
        entityId: memberUser._id,
        action: ACTIVITY_ACTION.MEMBER_ADDED,
        metadata: { targetEmail: memberUser.email, role: ROLES.MEMBER }
      },
      {
        workspaceId: workspace._id,
        actorId: adminUser._id,
        entityType: ACTIVITY_ENTITY.PROJECT,
        entityId: backendProject._id,
        action: ACTIVITY_ACTION.CREATED,
        metadata: { name: backendProject.name }
      },
      {
        workspaceId: workspace._id,
        actorId: memberUser._id,
        entityType: ACTIVITY_ENTITY.TASK,
        entityId: tasks[0]._id,
        action: ACTIVITY_ACTION.STATUS_CHANGED,
        metadata: { from: 'IN_PROGRESS', to: 'DONE', taskTitle: tasks[0].title }
      }
    ]);

    logger.info('DATABASE SEEDING COMPLETED SUCCESSFULLY ON MONGODB ATLAS!');
    logger.info('Summary of seeded collections:');
    logger.info(`- Users: 3 (Admin: ayush@example.com, Member: sarah.dev@example.com, Viewer: alex.viewer@example.com)`);
    logger.info(`- Workspaces: 1 (DevCollab Engineering)`);
    logger.info(`- Memberships: 3 (1 Admin, 1 Member, 1 Viewer)`);
    logger.info(`- Projects: 2 (Core API & Cloud Backend, Kanban Frontend Client)`);
    logger.info(`- Tasks: 5 (Spread across TODO, IN_PROGRESS, DONE)`);
    logger.info(`- Activities: 4`);
  } catch (error) {
    logger.error('Error during database seeding:', error);
  } finally {
    await disconnectDB();
  }
};

seedDatabase();
