import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const directConversationSchema = z.object({
  recipientId: z
    .string({ required_error: 'Recipient user ID is required' })
    .regex(objectIdRegex, 'Invalid recipient user ID format'),
  workspaceId: z
    .string({ required_error: 'Workspace ID is required' })
    .regex(objectIdRegex, 'Invalid workspace ID format')
});

export const projectConversationParamSchema = z.object({
  projectId: z
    .string({ required_error: 'Project ID is required' })
    .regex(objectIdRegex, 'Invalid project ID format')
});

export const conversationParamSchema = z.object({
  conversationId: z
    .string({ required_error: 'Conversation ID is required' })
    .regex(objectIdRegex, 'Invalid conversation ID format')
});

export const createMessageSchema = z.object({
  content: z
    .string({ required_error: 'Message content is required' })
    .trim()
    .min(1, 'Message content cannot be empty')
    .max(5000, 'Message content cannot exceed 5000 characters')
});

export const messageQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50))
    .refine((val) => !isNaN(val) && val >= 1 && val <= 100, {
      message: 'Limit must be a number between 1 and 100'
    })
});
