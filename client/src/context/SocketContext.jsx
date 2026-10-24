import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useWorkspace } from './WorkspaceContext';

const SocketContext = createContext(null);

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

export const SocketProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState('disconnected'); // 'connected' | 'connecting' | 'disconnected'
  const socketRef = useRef(null);
  const activeRoomRef = useRef(null);

  // Initialize socket connection when user is authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
      setStatus('disconnected');
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

      // If a workspace is already selected, join room immediately on connect/reconnect
      if (currentWorkspace?._id) {
        socket.emit('join:workspace', { workspaceId: currentWorkspace._id }, (res) => {
          if (res?.success) {
            activeRoomRef.current = currentWorkspace._id;
          }
        });
      }
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      setStatus(reason === 'io client disconnect' ? 'disconnected' : 'connecting');
      activeRoomRef.current = null;
    });

    socket.on('connect_error', () => {
      setIsConnected(false);
      setStatus('disconnected');
    });

    return () => {
      if (activeRoomRef.current && socket.connected) {
        socket.emit('leave:workspace', { workspaceId: activeRoomRef.current });
      }
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setStatus('disconnected');
      activeRoomRef.current = null;
    };
  }, [isAuthenticated]);

  // Sync workspace room subscription when current workspace changes
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    const newWorkspaceId = currentWorkspace?._id;
    const oldWorkspaceId = activeRoomRef.current;

    if (oldWorkspaceId && oldWorkspaceId !== newWorkspaceId) {
      socket.emit('leave:workspace', { workspaceId: oldWorkspaceId });
      activeRoomRef.current = null;
    }

    if (newWorkspaceId && newWorkspaceId !== oldWorkspaceId) {
      socket.emit('join:workspace', { workspaceId: newWorkspaceId }, (res) => {
        if (res?.success) {
          activeRoomRef.current = newWorkspaceId;
        }
      });
    }
  }, [currentWorkspace?._id, isConnected]);

  const value = {
    socket: socketRef.current,
    isConnected,
    status
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
