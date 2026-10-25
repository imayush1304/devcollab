import { ConversationService } from '../services/conversation.service.js';
import { successResponse } from '../utils/apiResponse.js';
import { BadRequestError } from '../utils/errors.js';
import { getIO } from '../sockets/socketHandler.js';

export const getUserConversations = async (req, res, next) => {
  try {
    const { workspaceId } = req.query;
    if (!workspaceId) {
      throw new BadRequestError('workspaceId query parameter is required');
    }

    const conversations = await ConversationService.getUserConversations(
      req.user._id,
      workspaceId
    );

    return successResponse(res, conversations, 'Conversations retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getOrCreateDirectConversation = async (req, res, next) => {
  try {
    const { recipientId, workspaceId } = req.body;
    const conversation = await ConversationService.getOrCreateDirectConversation(
      req.user._id,
      recipientId,
      workspaceId
    );

    return successResponse(res, conversation, 'Direct conversation retrieved or created', 201);
  } catch (error) {
    next(error);
  }
};

export const getOrCreateProjectConversation = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { workspaceId } = req.query;

    if (!workspaceId) {
      throw new BadRequestError('workspaceId query parameter is required');
    }

    const conversation = await ConversationService.getOrCreateProjectConversation(
      workspaceId,
      projectId,
      req.user._id
    );

    return successResponse(res, conversation, 'Project conversation retrieved or created');
  } catch (error) {
    next(error);
  }
};

export const getConversationDetails = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const conversation = await ConversationService.verifyConversationAccess(
      conversationId,
      req.user._id
    );

    return successResponse(res, conversation, 'Conversation details retrieved');
  } catch (error) {
    next(error);
  }
};

export const getMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { cursor, limit } = req.query;

    const result = await ConversationService.getMessages(conversationId, req.user._id, {
      cursor,
      limit
    });

    return successResponse(
      res,
      result.messages,
      'Messages retrieved successfully',
      200,
      result.pagination
    );
  } catch (error) {
    next(error);
  }
};

export const sendMessage = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { content } = req.body;

    const result = await ConversationService.createMessage(
      conversationId,
      req.user._id,
      content
    );

    // Broadcast message to room if Socket.IO is initialized
    try {
      const io = getIO();
      if (io) {
        const room = `conversation:${conversationId}`;
        // Broadcast to other participants in room
        io.to(room).emit('message:new', result.message);
        // Broadcast conversation preview update
        io.to(`workspace:${result.workspaceId}`).emit('conversation:updated', {
          conversationId,
          lastMessageAt: result.message.createdAt,
          lastMessage: {
            content: result.message.content.substring(0, 120),
            senderId: req.user._id,
            createdAt: result.message.createdAt
          }
        });
      }
    } catch (socketErr) {
      // Non-fatal if socket broadcast fails
    }

    return successResponse(res, result.message, 'Message sent successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const markConversationRead = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const result = await ConversationService.markConversationRead(
      conversationId,
      req.user._id
    );

    return successResponse(res, result, 'Conversation marked as read');
  } catch (error) {
    next(error);
  }
};

export const getUnreadCount = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const result = await ConversationService.getUnreadCount(
      conversationId,
      req.user._id
    );

    return successResponse(res, result, 'Unread count retrieved');
  } catch (error) {
    next(error);
  }
};
