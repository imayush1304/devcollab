import mongoose from 'mongoose';

export const ROLES = {
  ADMIN: 'Admin',
  MEMBER: 'Member',
  VIEWER: 'Viewer'
};

const membershipSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Workspace ID is required'],
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true
    },
    role: {
      type: String,
      enum: {
        values: Object.values(ROLES),
        message: '{VALUE} is not a valid workspace role'
      },
      default: ROLES.MEMBER,
      required: true
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

// Prevent duplicate memberships in the same workspace
membershipSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });

export const Membership = mongoose.model('Membership', membershipSchema);
