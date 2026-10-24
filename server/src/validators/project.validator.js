import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z
    .string({ required_error: 'Project name is required' })
    .trim()
    .min(2, 'Project name must be at least 2 characters long')
    .max(100, 'Project name cannot exceed 100 characters'),
  description: z
    .string()
    .trim()
    .max(1000, 'Description cannot exceed 1000 characters')
    .optional()
    .default('')
});

export const updateProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Project name must be at least 2 characters long')
    .max(100, 'Project name cannot exceed 100 characters')
    .optional(),
  description: z
    .string()
    .trim()
    .max(1000, 'Description cannot exceed 1000 characters')
    .optional()
});
