import mongoose from 'mongoose';

export const CONVERSATION_TYPE = {
  PROJECT: 'PROJECT',
  DIRECT: 'DIRECT'
};

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: {
        values: Object.values(CONVERSATION_TYPE),
        message: '{VALUE} is not a valid conversation type'
      },
      required: [true, 'Conversation type is required']
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Workspace ID is required'],
      index: true
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project'
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    // Deterministic key for DIRECT conversations: min(userIdA, userIdB)_max(userIdA, userIdB)
    directKey: {
      type: String
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    lastMessage: {
      content: {
        type: String,
        default: ''
      },
      senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },
      createdAt: {
        type: Date,
        default: null
      }
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator User ID is required']
    }
  },
  {
    timestamps: true,
    autoIndex: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Unique index for PROJECT conversations (only 1 conversation channel per project)
conversationSchema.index(
  { workspaceId: 1, projectId: 1 },
  {
    unique: true,
    sparse: true
  }
);

// Concurrency-safe unique index for DIRECT conversations (only 1 DM between same 2 users in workspace)
conversationSchema.index(
  { workspaceId: 1, directKey: 1 },
  {
    unique: true,
    sparse: true
  }
);

// Chronological search index
conversationSchema.index({ workspaceId: 1, lastMessageAt: -1 });

// Helper function to generate canonical directKey for two user IDs
conversationSchema.statics.generateDirectKey = function (userId1, userId2) {
  const id1 = userId1.toString();
  const id2 = userId2.toString();
  return id1 < id2 ? `${id1}_${id2}` : `${id2}_${id1}`;
};

export const Conversation = mongoose.model('Conversation', conversationSchema);
