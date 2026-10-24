import { z } from 'zod';
import { TASK_STATUS, TASK_PRIORITY } from '../models/Task.js';

export const createTaskSchema = z.object({
  title: z
    .string({ required_error: 'Task title is required' })
    .trim()
    .min(1, 'Task title cannot be empty')
    .max(200, 'Task title cannot exceed 200 characters'),
  description: z
    .string()
    .trim()
    .max(5000, 'Description cannot exceed 5000 characters')
    .optional()
    .default(''),
  status: z
    .enum(Object.values(TASK_STATUS), {
      errorMap: () => ({ message: `Status must be one of: ${Object.values(TASK_STATUS).join(', ')}` })
    })
    .default(TASK_STATUS.TODO),
  priority: z
    .enum(Object.values(TASK_PRIORITY), {
      errorMap: () => ({ message: `Priority must be one of: ${Object.values(TASK_PRIORITY).join(', ')}` })
    })
    .default(TASK_PRIORITY.MEDIUM),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional()
});

export const updateTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Task title cannot be empty')
    .max(200, 'Task title cannot exceed 200 characters')
    .optional(),
  description: z
    .string()
    .trim()
    .max(5000, 'Description cannot exceed 5000 characters')
    .optional(),
  status: z
    .enum(Object.values(TASK_STATUS), {
      errorMap: () => ({ message: `Status must be one of: ${Object.values(TASK_STATUS).join(', ')}` })
    })
    .optional(),
  priority: z
    .enum(Object.values(TASK_PRIORITY), {
      errorMap: () => ({ message: `Priority must be one of: ${Object.values(TASK_PRIORITY).join(', ')}` })
    })
    .optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  version: z.number().optional()
});

export const taskQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(Object.values(TASK_STATUS)).optional(),
  priority: z.enum(Object.values(TASK_PRIORITY)).optional(),
  assigneeId: z.string().optional(),
  sortBy: z.enum(['createdAt', 'dueDate', 'priority', 'updatedAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('50')
});
