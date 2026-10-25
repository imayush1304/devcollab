import api from './api';

export const conversationService = {
  // Get all conversations accessible to the current user in a workspace
  getConversations: async (workspaceId) => {
    const res = await api.get('/conversations', {
      params: { workspaceId }
    });
    return res.data || [];
  },

  // Find or create direct conversation between current user and recipient
  getOrCreateDirect: async (recipientId, workspaceId) => {
    const res = await api.post('/conversations/direct', {
      recipientId,
      workspaceId
    });
    return res.data;
  },

  // Get or auto-provision project channel conversation
  getOrCreateProjectChannel: async (projectId, workspaceId) => {
    const res = await api.get(`/conversations/project/${projectId}`, {
      params: { workspaceId }
    });
    return res.data;
  },

  // Get single conversation details
  getConversation: async (conversationId) => {
    const res = await api.get(`/conversations/${conversationId}`);
    return res.data;
  },

  // Retrieve paginated messages
  getMessages: async (conversationId, { cursor, limit = 50 } = {}) => {
    const res = await api.get(`/conversations/${conversationId}/messages`, {
      params: { cursor, limit }
    });
    return {
      messages: res.data || [],
      pagination: res.meta || { hasMore: false, nextCursor: null, limit: 50 }
    };
  },

  // Send a message via REST fallback
  sendMessage: async (conversationId, content) => {
    const res = await api.post(`/conversations/${conversationId}/messages`, {
      content
    });
    return res.data;
  },

  // Mark conversation as read
  markAsRead: async (conversationId) => {
    const res = await api.post(`/conversations/${conversationId}/read`);
    return res.data;
  },

  // Get unread count for conversation
  getUnreadCount: async (conversationId) => {
    const res = await api.get(`/conversations/${conversationId}/unread-count`);
    return res.data;
  }
};
