import mongoose from 'mongoose';

export const ACTIVITY_ENTITY = {
  TASK: 'TASK',
  PROJECT: 'PROJECT',
  WORKSPACE: 'WORKSPACE',
  COMMENT: 'COMMENT',
  MEMBERSHIP: 'MEMBERSHIP'
};

export const ACTIVITY_ACTION = {
  CREATED: 'CREATED',
  UPDATED: 'UPDATED',
  DELETED: 'DELETED',
  ASSIGNED: 'ASSIGNED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  PRIORITY_CHANGED: 'PRIORITY_CHANGED',
  DUE_DATE_CHANGED: 'DUE_DATE_CHANGED',
  COMMENT_ADDED: 'COMMENT_ADDED',
  MEMBER_ADDED: 'MEMBER_ADDED',
  MEMBER_REMOVED: 'MEMBER_REMOVED',
  ROLE_CHANGED: 'ROLE_CHANGED'
};

const activitySchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Workspace ID is required'],
      index: true
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Actor User ID is required']
    },
    entityType: {
      type: String,
      enum: Object.values(ACTIVITY_ENTITY),
      required: true
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    action: {
      type: String,
      enum: Object.values(ACTIVITY_ACTION),
      required: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      }
    }
  }
);

activitySchema.index({ workspaceId: 1, createdAt: -1 });
activitySchema.index({ entityId: 1, createdAt: -1 });

export const Activity = mongoose.model('Activity', activitySchema);
