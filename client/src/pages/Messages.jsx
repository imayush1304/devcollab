import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { useSocket } from '../context/SocketContext';
import { conversationService } from '../services/conversationService';
import { Avatar } from '../components/common/Avatar';
import {
  Hash,
  MessageSquare,
  Send,
  Search,
  Plus,
  ArrowLeft,
  WifiOff,
  AlertCircle,
  Clock,
  ChevronDown,
  User,
  Users,
  X,
  Sparkles,
  RefreshCw
} from 'lucide-react';

// Pure Date formatting helper
const formatMessageTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Today at ${timeStr}`;

  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday at ${timeStr}`;
  }

  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
};

export const Messages = () => {
  const { conversationId: routeConversationId } = useParams();
  const { user } = useAuth();
  const { currentWorkspace, members } = useWorkspace();
  const {
    socket,
    isConnected,
    isUserOnline,
    joinConversation,
    leaveConversation,
    sendMessageRealtime,
    markConversationReadRealtime
  } = useSocket();

  // State
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newDmModalOpen, setNewDmModalOpen] = useState(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);

  // References
  const messageEndRef = useRef(null);
  const messageContainerRef = useRef(null);
  const activeConvIdRef = useRef(null);
  const isNearBottomRef = useRef(true);

  // Keep activeConvIdRef updated for socket callbacks
  useEffect(() => {
    activeConvIdRef.current = activeConversation?._id || null;
  }, [activeConversation?._id]);

  // 1. Fetch Conversations for Workspace
  const loadConversations = useCallback(
    async (selectId = null) => {
      if (!currentWorkspace?._id) return;
      try {
        setLoadingConversations(true);
        const list = await conversationService.getConversations(currentWorkspace._id);
        setConversations(list || []);

        // Determine which conversation to select
        if (selectId) {
          const found = list.find((c) => c._id === selectId);
          if (found) {
            setActiveConversation(found);
            return;
          }
        }

        if (routeConversationId) {
          const matched = list.find((c) => c._id === routeConversationId);
          if (matched) {
            setActiveConversation(matched);
            return;
          }
        }

        // Default to first conversation if none selected yet on desktop
        if (window.innerWidth >= 768 && list.length > 0 && !activeConversation) {
          setActiveConversation(list[0]);
        }
      } catch (err) {
        console.error('Failed to load conversations:', err);
      } finally {
        setLoadingConversations(false);
      }
    },
    [currentWorkspace?._id, routeConversationId]
  );

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // 2. Load Messages for Active Conversation
  const loadMessages = useCallback(
    async (conversationId) => {
      if (!conversationId) {
        setMessages([]);
        return;
      }

      try {
        setLoadingMessages(true);
        setSendError(null);
        const res = await conversationService.getMessages(conversationId, { limit: 50 });
        setMessages(res.messages || []);
        setHasMore(res.pagination?.hasMore || false);
        setNextCursor(res.pagination?.nextCursor || null);

        // Mark as read in backend and via socket
        await conversationService.markAsRead(conversationId);
        markConversationReadRealtime(conversationId);

        // Update local conversation unread badge
        setConversations((prev) =>
          prev.map((c) => (c._id === conversationId ? { ...c, unreadCount: 0 } : c))
        );

        // Auto-scroll to bottom after render
        setTimeout(() => {
          if (messageEndRef.current) {
            messageEndRef.current.scrollIntoView({ behavior: 'auto' });
          }
        }, 50);
      } catch (err) {
        console.error('Failed to load messages for conversation:', err);
      } finally {
        setLoadingMessages(false);
      }
    },
    [markConversationReadRealtime]
  );

  // 3. Load Older Messages (Pagination)
  const loadOlderMessages = async () => {
    if (!activeConversation?._id || !hasMore || !nextCursor || loadingOlder) return;

    try {
      setLoadingOlder(true);
      const container = messageContainerRef.current;
      const prevScrollHeight = container?.scrollHeight || 0;
      const prevScrollTop = container?.scrollTop || 0;

      const res = await conversationService.getMessages(activeConversation._id, {
        cursor: nextCursor,
        limit: 50
      });

      setMessages((prev) => [...(res.messages || []), ...prev]);
      setHasMore(res.pagination?.hasMore || false);
      setNextCursor(res.pagination?.nextCursor || null);

      // Restore scroll offset so view doesn't jump
      setTimeout(() => {
        if (container) {
          const newScrollHeight = container.scrollHeight;
          container.scrollTop = newScrollHeight - prevScrollHeight + prevScrollTop;
        }
      }, 30);
    } catch (err) {
      console.error('Failed to load older messages:', err);
    } finally {
      setLoadingOlder(false);
    }
  };

  // 4. Socket Room Subscription when Active Conversation Changes
  useEffect(() => {
    const convId = activeConversation?._id;
    if (!convId) return;

    // Join room via socket
    joinConversation(convId).catch((err) => {
      console.warn('Socket joinConversation failed, falling back to REST:', err.message);
    });

    loadMessages(convId);

    return () => {
      leaveConversation(convId);
    };
  }, [activeConversation?._id, joinConversation, leaveConversation, loadMessages]);

  // 5. Global Socket Listeners for Real-Time Messages and Updates
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (newMsg) => {
      const currentActiveId = activeConvIdRef.current;
      const msgConvId = newMsg.conversationId;

      // If message is for currently open conversation
      if (currentActiveId && msgConvId === currentActiveId) {
        setMessages((prev) => {
          // Prevent duplicates
          if (prev.some((m) => m._id === newMsg._id)) return prev;
          return [...prev, newMsg];
        });

        // Mark as read immediately since user is actively viewing
        conversationService.markAsRead(currentActiveId).catch(() => {});
        markConversationReadRealtime(currentActiveId);

        // If user was near bottom, scroll down; otherwise show new message alert
        if (isNearBottomRef.current) {
          setTimeout(() => {
            messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 40);
        } else {
          setShowScrollBottomBtn(true);
        }
      }

      // Update sidebar conversation snippet and unread counter
      setConversations((prev) => {
        return prev
          .map((conv) => {
            if (conv._id === msgConvId) {
              const isCurrentOpen = currentActiveId === msgConvId;
              const newUnread = isCurrentOpen ? 0 : (conv.unreadCount || 0) + 1;
              return {
                ...conv,
                lastMessageAt: newMsg.createdAt,
                lastMessage: {
                  content: newMsg.content.substring(0, 120),
                  senderId: newMsg.senderId?._id || newMsg.senderId,
                  createdAt: newMsg.createdAt
                },
                unreadCount: newUnread
              };
            }
            return conv;
          })
          .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
      });
    };

    const handleConversationUpdated = (update) => {
      setConversations((prev) => {
        return prev
          .map((conv) => {
            if (conv._id === update.conversationId) {
              return {
                ...conv,
                lastMessageAt: update.lastMessageAt,
                lastMessage: update.lastMessage
              };
            }
            return conv;
          })
          .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
      });
    };

    const handleUnreadUpdated = ({ conversationId, unreadCount }) => {
      setConversations((prev) =>
        prev.map((c) => (c._id === conversationId ? { ...c, unreadCount } : c))
      );
    };

    socket.on('message:new', handleNewMessage);
    socket.on('conversation:updated', handleConversationUpdated);
    socket.on('conversation:unread-updated', handleUnreadUpdated);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('conversation:updated', handleConversationUpdated);
      socket.off('conversation:unread-updated', handleUnreadUpdated);
    };
  }, [socket, markConversationReadRealtime]);

  // Monitor Scroll Position to toggle auto-scroll and bottom button
  const handleScroll = () => {
    const container = messageContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceToBottom = scrollHeight - (scrollTop + clientHeight);

    // Near bottom if within 120px
    const nearBottom = distanceToBottom < 120;
    isNearBottomRef.current = nearBottom;

    if (nearBottom && showScrollBottomBtn) {
      setShowScrollBottomBtn(false);
    }
  };

  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollBottomBtn(false);
  };

  // 6. Handle Send Message
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!messageInput.trim() || !activeConversation?._id || sending) return;

    const content = messageInput.trim();
    const tempId = `temp_${Date.now()}`;
    setSending(true);
    setSendError(null);

    try {
      let savedMessage = null;

      // Try Socket.IO real-time send first
      if (isConnected) {
        try {
          const res = await sendMessageRealtime(activeConversation._id, content, tempId);
          savedMessage = res.message;
        } catch (socketErr) {
          console.warn('Real-time socket delivery failed, falling back to REST:', socketErr);
        }
      }

      // If socket delivery failed or disconnected, use REST fallback
      if (!savedMessage) {
        savedMessage = await conversationService.sendMessage(
          activeConversation._id,
          content
        );
      }

      // Append persisted message to local list (no duplicate echo)
      setMessages((prev) => [...prev, savedMessage]);
      setMessageInput('');

      // Update sidebar conversation snippet
      setConversations((prev) => {
        return prev
          .map((c) => {
            if (c._id === activeConversation._id) {
              return {
                ...c,
                lastMessageAt: savedMessage.createdAt,
                lastMessage: {
                  content: savedMessage.content.substring(0, 120),
                  senderId: user._id,
                  createdAt: savedMessage.createdAt
                }
              };
            }
            return c;
          })
          .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
      });

      // Smooth scroll down to newest message
      setTimeout(() => {
        messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 30);
    } catch (err) {
      setSendError(err.message || 'Failed to send message. Please retry.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 7. Start Direct Message with Member
  const handleStartDirectMessage = async (recipientId) => {
    try {
      const conv = await conversationService.getOrCreateDirect(
        recipientId,
        currentWorkspace._id
      );
      setNewDmModalOpen(false);

      // Re-load conversations and select newly created or found DM
      await loadConversations(conv._id);
      setActiveConversation(conv);
    } catch (err) {
      console.error('Failed to create direct conversation:', err);
    }
  };

  // Filtered lists for sidebar
  const projectChannels = conversations.filter(
    (c) =>
      c.type === 'PROJECT' &&
      (c.projectId?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const directMessages = conversations.filter((c) => {
    if (c.type !== 'DIRECT') return false;
    const otherParticipant = c.participants?.find((p) => (p._id || p) !== user?._id);
    const otherName = otherParticipant?.name || '';
    return otherName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Helper to get Direct Message recipient details
  const getDmRecipient = (conv) => {
    if (!conv?.participants) return null;
    return conv.participants.find((p) => (p._id || p) !== user?._id) || conv.participants[0];
  };

  return (
    <div className="h-[calc(100vh-4.5rem)] flex flex-col bg-[#090d16] rounded-2xl border border-gray-800/80 overflow-hidden shadow-2xl">
      {/* Offline Alert Strip */}
      {!isConnected && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center space-x-2">
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Real-time sync is currently offline. Reconnecting in the background...
            </span>
          </div>
          <span className="text-[11px] opacity-80">Messages will queue or use REST fallback</span>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* ======================================================== */}
        {/* LEFT PANEL: Conversation Sidebar                         */}
        {/* ======================================================== */}
        <div
          className={`${
            activeConversation ? 'hidden md:flex' : 'flex'
          } w-full md:w-80 shrink-0 border-r border-gray-800/80 bg-[#090d16] flex-col overflow-hidden select-none`}
        >
          {/* Header + Search */}
          <div className="p-3.5 border-b border-gray-800/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-semibold text-white tracking-tight">Messages</h2>
              </div>
              <button
                onClick={() => setNewDmModalOpen(true)}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium text-indigo-300 bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/30 transition-all cursor-pointer"
                title="Start a new Direct Message"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New DM</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search channels or people..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-gray-900/80 border border-gray-800 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-4">
            {loadingConversations ? (
              <div className="p-4 text-center text-xs text-gray-500 space-y-2">
                <RefreshCw className="w-4 h-4 animate-spin mx-auto text-indigo-500" />
                <p>Loading channels & messages...</p>
              </div>
            ) : (
              <>
                {/* 1. Project Channels */}
                <div>
                  <div className="px-2.5 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Project Channels ({projectChannels.length})</span>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {projectChannels.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-gray-500 italic">No channels found</p>
                    ) : (
                      projectChannels.map((channel) => {
                        const isActive = activeConversation?._id === channel._id;
                        return (
                          <button
                            key={channel._id}
                            onClick={() => setActiveConversation(channel)}
                            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-all cursor-pointer ${
                              isActive
                                ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30 shadow-sm'
                                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
                            }`}
                          >
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <div
                                className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                                  isActive
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'bg-gray-800 text-gray-400'
                                }`}
                              >
                                <Hash className="w-3.5 h-3.5" />
                              </div>
                              <span className="truncate text-xs">
                                {channel.projectId?.name || 'project-channel'}
                              </span>
                            </div>
                            {channel.unreadCount > 0 && (
                              <span className="ml-2 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold text-white shadow-xs">
                                {channel.unreadCount > 9 ? '9+' : channel.unreadCount}
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* 2. Direct Messages */}
                <div>
                  <div className="px-2.5 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Direct Messages ({directMessages.length})</span>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {directMessages.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-gray-500 italic">No direct messages yet</p>
                    ) : (
                      directMessages.map((conv) => {
                        const recipient = getDmRecipient(conv);
                        const isOnline = isUserOnline(recipient?._id);
                        const isActive = activeConversation?._id === conv._id;

                        return (
                          <button
                            key={conv._id}
                            onClick={() => setActiveConversation(conv)}
                            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-all cursor-pointer ${
                              isActive
                                ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30 shadow-sm'
                                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
                            }`}
                          >
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <div className="relative shrink-0">
                                <Avatar user={recipient} size="sm" />
                                {/* Presence Dot */}
                                <span
                                  className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-gray-900 ${
                                    isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'
                                  }`}
                                  title={isOnline ? 'Online' : 'Offline'}
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium text-gray-200">
                                  {recipient?.name || 'Workspace Member'}
                                </p>
                                {conv.lastMessage?.content && (
                                  <p className="truncate text-[10px] text-gray-500">
                                    {conv.lastMessage.content}
                                  </p>
                                )}
                              </div>
                            </div>
                            {conv.unreadCount > 0 && (
                              <span className="ml-2 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs">
                                {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT PANEL: Active Chat Thread                          */}
        {/* ======================================================== */}
        <div
          className={`${
            activeConversation ? 'flex' : 'hidden md:flex'
          } flex-1 flex-col bg-[#0b0f19] min-w-0 overflow-hidden relative`}
        >
          {activeConversation ? (
            <>
              {/* Chat Header */}
              <div className="h-14 border-b border-gray-800/80 px-4 flex items-center justify-between bg-[#0b0f19]/80 backdrop-blur-md">
                <div className="flex items-center space-x-3 min-w-0">
                  {/* Mobile Back Button */}
                  <button
                    onClick={() => setActiveConversation(null)}
                    className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors cursor-pointer"
                    aria-label="Back to conversations"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  {activeConversation.type === 'PROJECT' ? (
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold shrink-0">
                        <Hash className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-white truncate">
                          {activeConversation.projectId?.name || 'Project Channel'}
                        </h3>
                        <p className="text-[10px] text-gray-400 truncate">
                          {activeConversation.projectId?.description || 'Project conversation channel'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    (() => {
                      const recipient = getDmRecipient(activeConversation);
                      const isOnline = isUserOnline(recipient?._id);
                      return (
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <div className="relative shrink-0">
                            <Avatar user={recipient} size="md" />
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-gray-900 ${
                                isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'
                              }`}
                            />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-white truncate">
                              {recipient?.name || 'Direct Message'}
                            </h3>
                            <div className="flex items-center space-x-1.5 text-[11px]">
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isOnline ? 'bg-emerald-400' : 'bg-gray-500'
                                }`}
                              />
                              <span className={isOnline ? 'text-emerald-400' : 'text-gray-400'}>
                                {isOnline ? 'Online' : 'Offline'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>

                <div className="flex items-center space-x-2 text-xs text-gray-400">
                  <span className="hidden sm:inline text-gray-500">
                    {messages.length} message{messages.length === 1 ? '' : 's'}
                  </span>
                </div>
              </div>

              {/* Message History Container */}
              <div
                ref={messageContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 space-y-4"
              >
                {/* Pagination: Load Older Button */}
                {hasMore && (
                  <div className="text-center pt-1 pb-3">
                    <button
                      onClick={loadOlderMessages}
                      disabled={loadingOlder}
                      className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium text-indigo-400 bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-800/40 transition-colors cursor-pointer"
                    >
                      {loadingOlder ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Loading earlier messages...</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3.5 h-3.5" />
                          <span>Load earlier messages</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {loadingMessages ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center space-y-2 text-gray-400 text-xs">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500" />
                      <p>Loading messages...</p>
                    </div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-200">No messages yet</h4>
                      <p className="text-xs text-gray-500 max-w-xs mt-1">
                        Start the conversation by sending a message below!
                      </p>
                    </div>
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isMe = (msg.senderId?._id || msg.senderId) === user?._id;
                    const sender = typeof msg.senderId === 'object' ? msg.senderId : null;

                    return (
                      <div
                        key={msg._id || index}
                        className={`flex space-x-3 ${isMe ? 'justify-end' : 'justify-start'}`}
                      >
                        {!isMe && (
                          <div className="shrink-0 mt-0.5">
                            <Avatar user={sender} size="md" />
                          </div>
                        )}

                        <div className={`max-w-[78%] sm:max-w-[70%] space-y-1`}>
                          {!isMe && (
                            <div className="flex items-center space-x-2 text-[11px] text-gray-400 px-1">
                              <span className="font-semibold text-gray-300">
                                {sender?.name || 'Member'}
                              </span>
                              <span className="text-gray-500">
                                {formatMessageTime(msg.createdAt)}
                              </span>
                            </div>
                          )}

                          <div
                            className={`px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
                              isMe
                                ? 'bg-indigo-600 text-white rounded-br-xs'
                                : 'bg-[#151c2c] border border-gray-800 text-gray-200 rounded-bl-xs'
                            }`}
                          >
                            {msg.content}
                          </div>

                          {isMe && (
                            <div className="text-right text-[10px] text-gray-500 pr-1">
                              {formatMessageTime(msg.createdAt)}
                            </div>
                          )}
                        </div>

                        {isMe && (
                          <div className="shrink-0 mt-0.5">
                            <Avatar user={user} size="md" />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                <div ref={messageEndRef} />
              </div>

              {/* Floating "Scroll to bottom" button when user is scrolled up */}
              {showScrollBottomBtn && (
                <button
                  onClick={scrollToBottom}
                  className="absolute bottom-20 right-6 px-3 py-1.5 rounded-full bg-indigo-600 text-white text-xs font-medium shadow-xl hover:bg-indigo-500 flex items-center space-x-1.5 transition-all animate-bounce cursor-pointer z-20"
                >
                  <span>New messages</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Message Composer & Input Form */}
              <div className="p-3 sm:p-4 border-t border-gray-800/80 bg-[#0c101a]">
                {sendError && (
                  <div className="mb-2 p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
                    <div className="flex items-center space-x-2 truncate">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span className="truncate">{sendError}</span>
                    </div>
                    <button
                      onClick={handleSendMessage}
                      className="text-xs font-semibold underline text-rose-300 hover:text-white shrink-0 ml-2"
                    >
                      Retry
                    </button>
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="space-y-1.5">
                  <div className="relative flex items-end rounded-2xl bg-gray-900/90 border border-gray-800 focus-within:border-indigo-500 transition-colors p-2 shadow-inner">
                    <textarea
                      rows={2}
                      placeholder={
                        activeConversation.type === 'PROJECT'
                          ? `Message #${activeConversation.projectId?.name || 'channel'}... (Enter to send, Shift+Enter for newline)`
                          : `Message ${getDmRecipient(activeConversation)?.name || 'colleague'}...`
                      }
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      maxLength={5000}
                      disabled={sending}
                      className="w-full bg-transparent text-xs sm:text-sm text-gray-200 placeholder-gray-500 resize-none focus:outline-none px-2 py-1 max-h-32"
                    />

                    <button
                      type="submit"
                      disabled={!messageInput.trim() || sending}
                      className={`p-2 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                        messageInput.trim() && !sending
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30'
                          : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                      }`}
                      aria-label="Send Message"
                    >
                      {sending ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Character Counter & Helper Tip */}
                  <div className="flex items-center justify-between px-1 text-[10px] text-gray-500">
                    <span className="hidden sm:inline">
                      Press <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400">Enter</kbd> to send, <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400">Shift + Enter</kbd> for newline
                    </span>
                    <span className={messageInput.length > 4500 ? 'text-amber-400 font-semibold' : ''}>
                      {messageInput.length} / 5000
                    </span>
                  </div>
                </form>
              </div>
            </>
          ) : (
            /* Empty Desktop Placeholder when no conversation is selected */
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-lg">
                <MessageSquare className="w-8 h-8" />
              </div>
              <div className="max-w-sm space-y-1">
                <h3 className="text-base font-semibold text-gray-200">DevCollab Real-Time Messaging</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Select a project channel or direct message from the left to start collaborating in real time with your team.
                </p>
              </div>
              <button
                onClick={() => setNewDmModalOpen(true)}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Start Direct Message</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL: Start New Direct Message                          */}
      {/* ======================================================== */}
      {newDmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
            onClick={() => setNewDmModalOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-[#0f1422] border border-gray-800 p-5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800/80">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold">
                  <User className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-white">Start a Direct Message</h3>
              </div>
              <button
                onClick={() => setNewDmModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-400 mt-2.5 mb-3">
              Select any member from <span className="font-semibold text-indigo-300">{currentWorkspace?.name}</span> to begin a private conversation:
            </p>

            {/* Members List */}
            <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
              {members
                .filter((m) => (m.userId?._id || m.userId) !== user?._id)
                .map((member) => {
                  const memberUser = typeof member.userId === 'object' ? member.userId : null;
                  const memberId = memberUser?._id || member.userId;
                  const online = isUserOnline(memberId);

                  return (
                    <button
                      key={member._id}
                      onClick={() => handleStartDirectMessage(memberId)}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-800/60 border border-transparent hover:border-gray-800 transition-all text-left cursor-pointer group"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="relative shrink-0">
                          <Avatar user={memberUser} size="md" />
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-gray-900 ${
                              online ? 'bg-emerald-400' : 'bg-gray-600'
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-200 truncate group-hover:text-indigo-300 transition-colors">
                            {memberUser?.name || 'Workspace Member'}
                          </p>
                          <p className="text-[10px] text-gray-400 truncate">{memberUser?.email}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                        {online ? 'Online' : 'Offline'}
                      </span>
                    </button>
                  );
                })}

              {members.filter((m) => (m.userId?._id || m.userId) !== user?._id).length === 0 && (
                <div className="text-center py-6 text-xs text-gray-500">
                  <Users className="w-6 h-6 mx-auto mb-2 text-gray-600" />
                  <p>No other members in this workspace yet.</p>
                  <p className="text-[11px] text-gray-600 mt-0.5">Invite teammates via the Members tab.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
