import mongoose from 'mongoose';

export const NOTIFICATION_TYPE = {
  TASK_ASSIGNED: 'TASK_ASSIGNED',
  TASK_STATUS_CHANGED: 'TASK_STATUS_CHANGED',
  TASK_COMMENT_ADDED: 'TASK_COMMENT_ADDED',
  WORKSPACE_INVITE: 'WORKSPACE_INVITE',
  ROLE_UPDATED: 'ROLE_UPDATED'
};

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient User ID is required'],
      index: true
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Workspace ID is required'],
      index: true
    },
    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPE),
      required: true
    },
    entityType: {
      type: String,
      enum: ['TASK', 'PROJECT', 'WORKSPACE', 'COMMENT'],
      required: true
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    readAt: {
      type: Date,
      default: null,
      index: true
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

// Optimize notification list and unread count queries
notificationSchema.index({ recipientId: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
