import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Workspace ID is required'],
      index: true
    },
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      minlength: [2, 'Project name must be at least 2 characters long'],
      maxlength: [100, 'Project name cannot exceed 100 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: ''
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator User ID is required']
    },
    archivedAt: {
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

// Index to query active projects per workspace
projectSchema.index({ workspaceId: 1, archivedAt: 1, createdAt: -1 });

export const Project = mongoose.model('Project', projectSchema);
