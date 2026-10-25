import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  directConversationSchema,
  projectConversationParamSchema,
  conversationParamSchema,
  createMessageSchema,
  messageQuerySchema
} from '../validators/conversation.validator.js';
import {
  getUserConversations,
  getOrCreateDirectConversation,
  getOrCreateProjectConversation,
  getConversationDetails,
  getMessages,
  sendMessage,
  markConversationRead,
  getUnreadCount
} from '../controllers/conversation.controller.js';

const router = express.Router();

// Require authentication for all conversation endpoints
router.use(authenticate);

// 1. List conversations for user in a workspace
router.get('/', getUserConversations);

// 2. Find or create a direct conversation
router.post('/direct', validate(directConversationSchema), getOrCreateDirectConversation);

// 3. Find or create a project channel conversation
router.get(
  '/project/:projectId',
  validate(projectConversationParamSchema, 'params'),
  getOrCreateProjectConversation
);

// 4. Retrieve conversation details
router.get(
  '/:conversationId',
  validate(conversationParamSchema, 'params'),
  getConversationDetails
);

// 5. Retrieve paginated messages
router.get(
  '/:conversationId/messages',
  validate(conversationParamSchema, 'params'),
  validate(messageQuerySchema, 'query'),
  getMessages
);

// 6. Send a message (REST endpoint / fallback)
router.post(
  '/:conversationId/messages',
  validate(conversationParamSchema, 'params'),
  validate(createMessageSchema),
  sendMessage
);

// 7. Mark conversation as read
router.post(
  '/:conversationId/read',
  validate(conversationParamSchema, 'params'),
  markConversationRead
);

// 8. Get unread message count for a conversation
router.get(
  '/:conversationId/unread-count',
  validate(conversationParamSchema, 'params'),
  getUnreadCount
);

export default router;
