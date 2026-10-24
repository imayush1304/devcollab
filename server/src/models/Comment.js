import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: [true, 'Task ID is required'],
      index: true
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Workspace ID is required'],
      index: true
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author User ID is required']
    },
    body: {
      type: String,
      required: [true, 'Comment body cannot be empty'],
      trim: true,
      minlength: [1, 'Comment must have at least 1 character'],
      maxlength: [2000, 'Comment cannot exceed 2000 characters']
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

// Index for chronologically fetching comments on a task
commentSchema.index({ taskId: 1, createdAt: 1 });

export const Comment = mongoose.model('Comment', commentSchema);
