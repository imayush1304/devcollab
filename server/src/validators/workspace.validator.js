import { z } from 'zod';
import { ROLES } from '../models/Membership.js';

export const createWorkspaceSchema = z.object({
  name: z
    .string({ required_error: 'Workspace name is required' })
    .trim()
    .min(2, 'Workspace name must be at least 2 characters long')
    .max(80, 'Workspace name cannot exceed 80 characters'),
  description: z
    .string()
    .trim()
    .max(500, 'Description cannot exceed 500 characters')
    .optional()
    .default('')
});

export const updateWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Workspace name must be at least 2 characters long')
    .max(80, 'Workspace name cannot exceed 80 characters')
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, 'Description cannot exceed 500 characters')
    .optional()
});

export const addMemberSchema = z.object({
  email: z
    .string({ required_error: 'User email is required' })
    .trim()
    .email('Please provide a valid email address')
    .toLowerCase(),
  role: z
    .enum(Object.values(ROLES), {
      errorMap: () => ({ message: `Role must be one of: ${Object.values(ROLES).join(', ')}` })
    })
    .default(ROLES.MEMBER)
});

export const updateRoleSchema = z.object({
  role: z.enum(Object.values(ROLES), {
    errorMap: () => ({ message: `Role must be one of: ${Object.values(ROLES).join(', ')}` })
  })
});
