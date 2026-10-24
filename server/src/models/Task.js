import mongoose from 'mongoose';

export const TASK_STATUS = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE'
};

export const TASK_PRIORITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT'
};

const taskSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project ID is required'],
      index: true
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Workspace ID is required'],
      index: true
    },
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      minlength: [1, 'Task title cannot be empty'],
      maxlength: [200, 'Task title cannot exceed 200 characters']
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [5000, 'Description cannot exceed 5000 characters']
    },
    status: {
      type: String,
      enum: {
        values: Object.values(TASK_STATUS),
        message: '{VALUE} is not a valid task status'
      },
      default: TASK_STATUS.TODO,
      index: true
    },
    priority: {
      type: String,
      enum: {
        values: Object.values(TASK_PRIORITY),
        message: '{VALUE} is not a valid task priority'
      },
      default: TASK_PRIORITY.MEDIUM,
      index: true
    },
    assigneeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator User ID is required']
    },
    dueDate: {
      type: Date,
      default: null,
      index: true
    },
    version: {
      type: Number,
      default: 1
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

// Compound indexes for optimal querying and Kanban boards
taskSchema.index({ projectId: 1, status: 1 });
taskSchema.index({ workspaceId: 1, updatedAt: -1 });
taskSchema.index({ workspaceId: 1, status: 1 });
taskSchema.index({ assigneeId: 1, status: 1 });
taskSchema.index({ title: 'text' });

export const Task = mongoose.model('Task', taskSchema);
