import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useWorkspace } from './WorkspaceContext';

const SocketContext = createContext(null);

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

export const SocketProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState('disconnected'); // 'connected' | 'connecting' | 'disconnected'
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const socketRef = useRef(null);
  const activeWorkspaceRoomRef = useRef(null);

  // Initialize socket connection when user is authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
      setStatus('disconnected');
      setOnlineUserIds([]);
      return;
    }

    const token = localStorage.getItem('devcollab_token');

    setStatus('connecting');
    const socket = io(SOCKET_URL, {
      withCredentials: true,
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setStatus('connected');

      // If a workspace is already selected, join workspace room immediately on connect/reconnect
      if (currentWorkspace?._id) {
        socket.emit('join:workspace', { workspaceId: currentWorkspace._id }, (res) => {
          if (res?.success) {
            activeWorkspaceRoomRef.current = currentWorkspace._id;
            if (Array.isArray(res.onlineUserIds)) {
              setOnlineUserIds(res.onlineUserIds);
            }
          }
        });
      }
    });

    // Listen to real-time presence events within the workspace
    socket.on('presence:updated', ({ userId, status: presenceStatus }) => {
      setOnlineUserIds((prev) => {
        const idStr = String(userId);
        if (presenceStatus === 'online') {
          return prev.includes(idStr) ? prev : [...prev, idStr];
        } else {
          return prev.filter((id) => id !== idStr);
        }
      });
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      setStatus(reason === 'io client disconnect' ? 'disconnected' : 'connecting');
      activeWorkspaceRoomRef.current = null;
    });

    socket.on('connect_error', () => {
      setIsConnected(false);
      setStatus('disconnected');
    });

    return () => {
      if (activeWorkspaceRoomRef.current && socket.connected) {
        socket.emit('leave:workspace', { workspaceId: activeWorkspaceRoomRef.current });
      }
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setStatus('disconnected');
      setOnlineUserIds([]);
      activeWorkspaceRoomRef.current = null;
    };
  }, [isAuthenticated]);

  // Sync workspace room subscription when current workspace changes
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    const newWorkspaceId = currentWorkspace?._id;
    const oldWorkspaceId = activeWorkspaceRoomRef.current;

    if (oldWorkspaceId && oldWorkspaceId !== newWorkspaceId) {
      socket.emit('leave:workspace', { workspaceId: oldWorkspaceId });
      activeWorkspaceRoomRef.current = null;
      setOnlineUserIds([]);
    }

    if (newWorkspaceId && newWorkspaceId !== oldWorkspaceId) {
      socket.emit('join:workspace', { workspaceId: newWorkspaceId }, (res) => {
        if (res?.success) {
          activeWorkspaceRoomRef.current = newWorkspaceId;
          if (Array.isArray(res.onlineUserIds)) {
            setOnlineUserIds(res.onlineUserIds);
          }
        }
      });
    }
  }, [currentWorkspace?._id, isConnected]);

  // Real-time helper: Join conversation room with ack
  const joinConversation = useCallback((conversationId) => {
    return new Promise((resolve, reject) => {
      const socket = socketRef.current;
      if (!socket || !socket.connected) {
        return resolve({ success: false, error: 'Socket not connected' });
      }
      socket.emit('conversation:join', { conversationId }, (res) => {
        if (res?.success) {
          resolve(res);
        } else {
          reject(new Error(res?.error || 'Failed to join conversation room'));
        }
      });
    });
  }, []);

  // Real-time helper: Leave conversation room
  const leaveConversation = useCallback((conversationId) => {
    const socket = socketRef.current;
    if (socket && socket.connected && conversationId) {
      socket.emit('conversation:leave', { conversationId });
    }
  }, []);

  // Real-time helper: Send message via Socket.IO with server acknowledgement
  const sendMessageRealtime = useCallback((conversationId, content, tempId = null) => {
    return new Promise((resolve, reject) => {
      const socket = socketRef.current;
      if (!socket || !socket.connected) {
        return reject(new Error('Socket disconnected. Cannot send real-time message.'));
      }

      // Timeout safety (8 seconds)
      const timeout = setTimeout(() => {
        reject(new Error('Message delivery timed out. Please try again.'));
      }, 8000);

      socket.emit('message:send', { conversationId, content, tempId }, (res) => {
        clearTimeout(timeout);
        if (res?.success) {
          resolve(res);
        } else {
          reject(new Error(res?.error || 'Failed to send message'));
        }
      });
    });
  }, []);

  // Real-time helper: Mark conversation read
  const markConversationReadRealtime = useCallback((conversationId) => {
    const socket = socketRef.current;
    if (socket && socket.connected && conversationId) {
      socket.emit('conversation:read', { conversationId });
    }
  }, []);

  // Helper to query if a user is currently online
  const isUserOnline = useCallback(
    (userId) => {
      if (!userId) return false;
      const targetId = typeof userId === 'object' ? userId._id || userId : userId;
      return onlineUserIds.includes(String(targetId));
    },
    [onlineUserIds]
  );

  const value = {
    socket: socketRef.current,
    isConnected,
    status,
    onlineUserIds,
    isUserOnline,
    joinConversation,
    leaveConversation,
    sendMessageRealtime,
    markConversationReadRealtime
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
