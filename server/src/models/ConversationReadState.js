import mongoose from 'mongoose';

const conversationReadStateSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: [true, 'Conversation ID is required'],
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true
    },
    lastReadAt: {
      type: Date,
      default: Date.now
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

// One read-state record per user per conversation
conversationReadStateSchema.index({ conversationId: 1, userId: 1 }, { unique: true });

export const ConversationReadState = mongoose.model(
  'ConversationReadState',
  conversationReadStateSchema
);
