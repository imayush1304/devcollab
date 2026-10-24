import { z } from 'zod';

export const createCommentSchema = z.object({
  body: z
    .string({ required_error: 'Comment body is required' })
    .trim()
    .min(1, 'Comment cannot be empty')
    .max(2000, 'Comment cannot exceed 2000 characters')
});
