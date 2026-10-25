import mongoose from 'mongoose';
import {
  Conversation,
  CONVERSATION_TYPE,
  Message,
  ConversationReadState,
  Membership,
  Project,
  User
} from '../models/index.js';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError
} from '../utils/errors.js';

export class ConversationService {
  /**
   * Helper to verify user is an active member of the workspace
   */
  static async verifyWorkspaceMembership(workspaceId, userId) {
    const membership = await Membership.findOne({
      workspaceId,
      userId
    });
    if (!membership) {
      throw new ForbiddenError('You are not a member of this workspace');
    }
    return membership;
  }

  /**
   * Verify that user has access to this conversation
   */
  static async verifyConversationAccess(conversationId, userId) {
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      throw new BadRequestError('Invalid conversation ID');
    }

    const conversation = await Conversation.findById(conversationId)
      .populate('projectId', 'name description archivedAt')
      .populate('participants', 'name email avatarUrl')
      .populate('createdBy', 'name email avatarUrl')
      .populate('lastMessage.senderId', 'name email avatarUrl');

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    // Verify workspace membership
    await this.verifyWorkspaceMembership(conversation.workspaceId, userId);

    // If direct conversation, verify user is one of the participants
    if (conversation.type === CONVERSATION_TYPE.DIRECT) {
      const isParticipant = conversation.participants.some((p) => {
        const id = p._id ? p._id.toString() : p.toString();
        return id === userId.toString();
      });

      if (!isParticipant) {
        throw new ForbiddenError('You are not a participant in this direct conversation');
      }
    }

    return conversation;
  }

  /**
   * List all conversations for the user in the specified workspace
   */
  static async getUserConversations(userId, workspaceId) {
    await this.verifyWorkspaceMembership(workspaceId, userId);

    // 1. Fetch all direct conversations where user is a participant
    const directConversations = await Conversation.find({
      workspaceId,
      type: CONVERSATION_TYPE.DIRECT,
      participants: userId
    })
      .populate('participants', 'name email avatarUrl')
      .populate('createdBy', 'name email avatarUrl')
      .populate('lastMessage.senderId', 'name email avatarUrl')
      .sort({ lastMessageAt: -1 })
      .lean();

    // 2. Fetch all project channels in this workspace
    // Ensure project channels exist for all active projects
    const activeProjects = await Project.find({
      workspaceId,
      archivedAt: null
    }).select('_id name description');

    // Auto-create or fetch project conversations for active projects
    const projectConversations = await Promise.all(
      activeProjects.map(async (project) => {
        return this.getOrCreateProjectConversation(workspaceId, project._id, userId);
      })
    );

    // 3. Compute unread counts for all conversations in parallel
    const allConversations = [...projectConversations, ...directConversations];

    // Read states for this user across these conversations
    const convIds = allConversations.map((c) => c._id);
    const readStates = await ConversationReadState.find({
      conversationId: { $in: convIds },
      userId
    }).lean();

    const readStateMap = new Map();
    readStates.forEach((rs) => {
      readStateMap.set(rs.conversationId.toString(), rs.lastReadAt);
    });

    // Calculate unread count for each conversation
    const enrichedConversations = await Promise.all(
      allConversations.map(async (conv) => {
        const convIdStr = conv._id.toString();
        const lastReadAt = readStateMap.get(convIdStr);

        const unreadFilter = {
          conversationId: conv._id,
          senderId: { $ne: userId }
        };
        if (lastReadAt) {
          unreadFilter.createdAt = { $gt: lastReadAt };
        }

        const unreadCount = await Message.countDocuments(unreadFilter);

        return {
          ...conv,
          unreadCount
        };
      })
    );

    // Sort all conversations by lastMessageAt descending
    return enrichedConversations.sort((a, b) => {
      const timeA = new Date(a.lastMessageAt || a.createdAt).getTime();
      const timeB = new Date(b.lastMessageAt || b.createdAt).getTime();
      return timeB - timeA;
    });
  }

  /**
   * Find or create a direct conversation between two users in a workspace (Concurrency-safe)
   */
  static async getOrCreateDirectConversation(userId, recipientId, workspaceId) {
    if (userId.toString() === recipientId.toString()) {
      throw new BadRequestError('Cannot start a direct conversation with yourself');
    }

    // Verify both users are members of the workspace
    await this.verifyWorkspaceMembership(workspaceId, userId);
    const recipientMembership = await Membership.findOne({
      workspaceId,
      userId: recipientId
    });
    if (!recipientMembership) {
      throw new BadRequestError('Recipient is not a member of this workspace');
    }

    const directKey = Conversation.generateDirectKey(userId, recipientId);

    // Attempt to find existing conversation
    let conversation = await Conversation.findOne({
      workspaceId,
      type: CONVERSATION_TYPE.DIRECT,
      directKey
    })
      .populate('participants', 'name email avatarUrl')
      .populate('createdBy', 'name email avatarUrl')
      .populate('lastMessage.senderId', 'name email avatarUrl');

    if (!conversation) {
      try {
        // Concurrency-safe creation
        const sortedParticipants = [userId, recipientId].sort();
        conversation = await Conversation.create({
          type: CONVERSATION_TYPE.DIRECT,
          workspaceId,
          directKey,
          participants: sortedParticipants,
          createdBy: userId,
          lastMessageAt: new Date()
        });

        // Initialize read state for creator
        await ConversationReadState.findOneAndUpdate(
          { conversationId: conversation._id, userId },
          { lastReadAt: new Date() },
          { upsert: true }
        );

        conversation = await Conversation.findById(conversation._id)
          .populate('participants', 'name email avatarUrl')
          .populate('createdBy', 'name email avatarUrl');
      } catch (err) {
        // Handle duplicate key race condition
        if (err.code === 11000) {
          conversation = await Conversation.findOne({
            workspaceId,
            type: CONVERSATION_TYPE.DIRECT,
            directKey
          })
            .populate('participants', 'name email avatarUrl')
            .populate('createdBy', 'name email avatarUrl')
            .populate('lastMessage.senderId', 'name email avatarUrl');
        } else {
          throw err;
        }
      }
    }

    return conversation;
  }

  /**
   * Find or create a project conversation channel for a workspace project
   */
  static async getOrCreateProjectConversation(workspaceId, projectId, userId) {
    await this.verifyWorkspaceMembership(workspaceId, userId);

    const project = await Project.findOne({
      _id: projectId,
      workspaceId
    });
    if (!project) {
      throw new NotFoundError('Project not found in this workspace');
    }

    let conversation = await Conversation.findOne({
      workspaceId,
      projectId,
      type: CONVERSATION_TYPE.PROJECT
    })
      .populate('projectId', 'name description archivedAt')
      .populate('createdBy', 'name email avatarUrl')
      .populate('lastMessage.senderId', 'name email avatarUrl');

    if (!conversation) {
      try {
        conversation = await Conversation.create({
          type: CONVERSATION_TYPE.PROJECT,
          workspaceId,
          projectId,
          createdBy: userId,
          lastMessageAt: new Date()
        });

        conversation = await Conversation.findById(conversation._id)
          .populate('projectId', 'name description archivedAt')
          .populate('createdBy', 'name email avatarUrl');
      } catch (err) {
        if (err.code === 11000) {
          conversation = await Conversation.findOne({
            workspaceId,
            projectId,
            type: CONVERSATION_TYPE.PROJECT
          })
            .populate('projectId', 'name description archivedAt')
            .populate('createdBy', 'name email avatarUrl')
            .populate('lastMessage.senderId', 'name email avatarUrl');
        } else {
          throw err;
        }
      }
    }

    return conversation;
  }

  /**
   * Retrieve paginated messages for a conversation
   */
  static async getMessages(conversationId, userId, { cursor, limit = 50 } = {}) {
    await this.verifyConversationAccess(conversationId, userId);

    const query = { conversationId };

    if (cursor) {
      // Cursor can be an ISO date or ObjectId
      if (mongoose.Types.ObjectId.isValid(cursor)) {
        query._id = { $lt: cursor };
      } else {
        const cursorDate = new Date(cursor);
        if (!isNaN(cursorDate.getTime())) {
          query.createdAt = { $lt: cursorDate };
        }
      }
    }

    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);

    // Fetch one extra item to check for next page
    const rawMessages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(safeLimit + 1)
      .populate('senderId', 'name email avatarUrl')
      .lean();

    const hasMore = rawMessages.length > safeLimit;
    const messages = hasMore ? rawMessages.slice(0, safeLimit) : rawMessages;

    // Next cursor for subsequent pagination
    const nextCursor = hasMore && messages.length > 0 ? messages[messages.length - 1].createdAt.toISOString() : null;

    // Return in chronological order (oldest to newest) for client rendering
    const chronologicalMessages = messages.reverse();

    return {
      messages: chronologicalMessages,
      pagination: {
        hasMore,
        nextCursor,
        limit: safeLimit
      }
    };
  }

  /**
   * Persist a new message to a conversation
   */
  static async createMessage(conversationId, senderId, content) {
    const conversation = await this.verifyConversationAccess(conversationId, senderId);

    if (!content || !content.trim()) {
      throw new BadRequestError('Message content cannot be empty');
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length > 5000) {
      throw new BadRequestError('Message cannot exceed 5000 characters');
    }

    // 1. Create and persist message
    const message = await Message.create({
      conversationId,
      senderId,
      content: trimmedContent
    });

    // 2. Atomically update conversation's lastMessageAt and preview
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessageAt: message.createdAt,
      lastMessage: {
        content: trimmedContent.substring(0, 120),
        senderId,
        createdAt: message.createdAt
      }
    });

    // 3. Mark read for sender
    await ConversationReadState.findOneAndUpdate(
      { conversationId, userId: senderId },
      { lastReadAt: message.createdAt },
      { upsert: true, returnDocument: 'after' }
    );

    // Populate sender details for immediate broadcast/return
    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'name email avatarUrl')
      .lean();

    return {
      message: populatedMessage,
      conversationId: conversationId.toString(),
      workspaceId: conversation.workspaceId.toString(),
      conversationType: conversation.type
    };
  }

  /**
   * Mark conversation as read for the user
   */
  static async markConversationRead(conversationId, userId) {
    await this.verifyConversationAccess(conversationId, userId);

    const now = new Date();
    await ConversationReadState.findOneAndUpdate(
      { conversationId, userId },
      { lastReadAt: now },
      { upsert: true, returnDocument: 'after' }
    );

    return {
      conversationId: conversationId.toString(),
      userId: userId.toString(),
      lastReadAt: now.toISOString(),
      unreadCount: 0
    };
  }

  /**
   * Get unread count for a specific conversation for the user
   */
  static async getUnreadCount(conversationId, userId) {
    await this.verifyConversationAccess(conversationId, userId);

    const readState = await ConversationReadState.findOne({
      conversationId,
      userId
    }).lean();

    const query = {
      conversationId,
      senderId: { $ne: userId }
    };

    if (readState?.lastReadAt) {
      query.createdAt = { $gt: readState.lastReadAt };
    }

    const count = await Message.countDocuments(query);
    return {
      conversationId: conversationId.toString(),
      unreadCount: count
    };
  }
}
