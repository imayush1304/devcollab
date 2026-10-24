import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useSocket } from '../../context/SocketContext';
import { notificationService } from '../../services/notificationService';
import { NotificationDropdown } from './NotificationDropdown';
import { Avatar } from './Avatar';
import { RoleBadge } from './Badge';
import {
  ChevronDown,
  Plus,
  LogOut,
  Building2,
  Check,
  ShieldAlert,
  Sparkles,
  Radio,
  Bell
} from 'lucide-react';

export const Navbar = ({ onOpenCreateWorkspace, onOpenCreateTask, onSelectNotificationTask }) => {
  const { user, logout } = useAuth();
  const {
    workspaces,
    currentWorkspace,
    currentRole,
    switchWorkspace,
    isViewer
  } = useWorkspace();
  const { isConnected, status, socket } = useSocket();

  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const wsDropdownRef = useRef(null);
  const userDropdownRef = useRef(null);
  const notifDropdownRef = useRef(null);

  // Load user notifications
  const loadNotifications = useCallback(async () => {
    try {
      const res = await notificationService.getNotifications({
        workspaceId: currentWorkspace?._id
      });
      setNotifications(res.data?.data || res.data || []);
      setUnreadCount(res.meta?.unreadCount || 0);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  }, [currentWorkspace?._id]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Listen for real-time notifications from Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);
    };

    socket.on('notification:created', handleNewNotification);

    return () => {
      socket.off('notification:created', handleNewNotification);
    };
  }, [socket]);

  const handleMarkAsRead = async (notificationId) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) =>
          n._id === notificationId ? { ...n, readAt: new Date().toISOString() } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead(currentWorkspace?._id);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wsDropdownRef.current && !wsDropdownRef.current.contains(e.target)) {
        setWorkspaceDropdownOpen(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target)) {
        setUserDropdownOpen(false);
      }
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target)) {
        setNotificationDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-14 border-b border-gray-800/80 bg-[#0c101a]/80 backdrop-blur-md sticky top-0 z-40 px-4 flex items-center justify-between">
      {/* Left: Workspace Switcher */}
      <div className="flex items-center space-x-3">
        <div className="relative" ref={wsDropdownRef}>
          <button
            onClick={() => setWorkspaceDropdownOpen(!workspaceDropdownOpen)}
            className="flex items-center space-x-2.5 px-3 py-1.5 rounded-xl bg-gray-900/80 hover:bg-gray-800/80 border border-gray-800 text-sm font-medium text-gray-200 transition-all cursor-pointer"
          >
            <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[11px] font-bold">
              {currentWorkspace?.name ? currentWorkspace.name.charAt(0).toUpperCase() : 'W'}
            </div>
            <span className="max-w-[150px] truncate text-xs sm:text-sm font-semibold">
              {currentWorkspace?.name || 'Select Workspace'}
            </span>
            {currentRole && <RoleBadge role={currentRole} />}
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </button>

          {/* Switcher Dropdown Menu */}
          {workspaceDropdownOpen && (
            <div className="absolute left-0 mt-2 w-64 rounded-xl bg-[#0f1422] border border-gray-800 shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-800/60">
                Workspaces ({workspaces.length})
              </div>
              <div className="max-h-60 overflow-y-auto py-1">
                {workspaces.map((ws) => (
                  <button
                    key={ws._id}
                    onClick={() => {
                      switchWorkspace(ws._id);
                      setWorkspaceDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-gray-800/60 transition-colors cursor-pointer ${
                      currentWorkspace?._id === ws._id ? 'text-indigo-400 bg-indigo-950/20' : 'text-gray-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <Building2 className="w-4 h-4 text-gray-500 shrink-0" />
                      <span className="truncate font-medium">{ws.name}</span>
                    </div>
                    {currentWorkspace?._id === ws._id && (
                      <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
              <div className="p-2 border-t border-gray-800/80">
                <button
                  onClick={() => {
                    setWorkspaceDropdownOpen(false);
                    onOpenCreateWorkspace();
                  }}
                  className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Workspace</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Real-time Status, Quick Action & User Menu */}
      <div className="flex items-center space-x-3">
        {/* Real-time Socket Live Sync Indicator */}
        <div
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
            isConnected
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : status === 'connecting'
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              : 'bg-gray-800/60 border-gray-700/60 text-gray-400'
          }`}
          title={
            isConnected
              ? 'Real-time live sync connected'
              : status === 'connecting'
              ? 'Connecting to real-time sync...'
              : 'Real-time sync offline'
          }
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isConnected
                ? 'bg-emerald-400 animate-pulse'
                : status === 'connecting'
                ? 'bg-amber-400 animate-ping'
                : 'bg-gray-500'
            }`}
          />
          <span className="hidden sm:inline">
            {isConnected ? 'Live' : status === 'connecting' ? 'Connecting' : 'Offline'}
          </span>
        </div>

        {/* Notification Center Bell & Dropdown */}
        <div className="relative" ref={notifDropdownRef}>
          <button
            onClick={() => setNotificationDropdownOpen(!notificationDropdownOpen)}
            className="relative p-2 rounded-xl bg-gray-900/80 hover:bg-gray-800/80 border border-gray-800 text-gray-300 hover:text-white transition-all cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-md shadow-rose-500/40 animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <NotificationDropdown
            isOpen={notificationDropdownOpen}
            onClose={() => setNotificationDropdownOpen(false)}
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkAsRead={handleMarkAsRead}
            onMarkAllAsRead={handleMarkAllAsRead}
            onSelectNotification={(notif) => {
              setNotificationDropdownOpen(false);
              if (notif.metadata?.taskId && onSelectNotificationTask) {
                onSelectNotificationTask(notif.metadata.taskId);
              }
            }}
          />
        </div>

        {/* "+ New Task" Quick Button (Disabled for Viewers) */}
        {!isViewer && onOpenCreateTask && (
          <button
            onClick={onOpenCreateTask}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Task</span>
          </button>
        )}

        {/* User Menu Dropdown */}
        <div className="relative" ref={userDropdownRef}>
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center space-x-2 p-1 rounded-xl hover:bg-gray-800/60 transition-all cursor-pointer"
          >
            <Avatar user={user} size="md" />
            <div className="text-left hidden md:block">
              <p className="text-xs font-medium text-gray-200 leading-tight">{user?.name}</p>
              <p className="text-[10px] text-gray-400 leading-tight">{user?.email}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 hidden md:block" />
          </button>

          {userDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[#0f1422] border border-gray-800 shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-4 py-2.5 border-b border-gray-800/80">
                <p className="text-xs font-semibold text-gray-200">{user?.name}</p>
                <p className="text-[11px] text-gray-400 truncate">{user?.email}</p>
              </div>
              <div className="p-1">
                <button
                  onClick={() => {
                    setUserDropdownOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-xs text-rose-400 hover:bg-rose-950/20 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
