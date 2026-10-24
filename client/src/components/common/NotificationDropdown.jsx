import React, { useState } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  UserCheck,
  MessageSquare,
  RefreshCw,
  Building2,
  ShieldCheck,
  Sparkles,
  Clock,
  ExternalLink
} from 'lucide-react';

export const NotificationDropdown = ({
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onSelectNotification,
  isOpen,
  onClose
}) => {
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'UNREAD'

  if (!isOpen) return null;

  const displayedNotifications =
    filter === 'UNREAD'
      ? notifications.filter((n) => !n.readAt)
      : notifications;

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay === 1) return 'Yesterday';
    return `${diffDay}d ago`;
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'TASK_ASSIGNED':
        return <UserCheck className="w-4 h-4 text-indigo-400" />;
      case 'TASK_STATUS_CHANGED':
        return <RefreshCw className="w-4 h-4 text-emerald-400" />;
      case 'TASK_COMMENT_ADDED':
        return <MessageSquare className="w-4 h-4 text-amber-400" />;
      case 'WORKSPACE_INVITE':
        return <Building2 className="w-4 h-4 text-purple-400" />;
      case 'ROLE_UPDATED':
        return <ShieldCheck className="w-4 h-4 text-cyan-400" />;
      default:
        return <Bell className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="absolute right-0 mt-2 w-[calc(100vw-24px)] sm:w-96 max-w-sm rounded-2xl bg-[#0f1422] border border-gray-800 shadow-2xl shadow-black/60 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
      {/* Header */}
      <div className="p-3.5 border-b border-gray-800/80 bg-gray-900/40 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-gray-100 uppercase tracking-wider">
            Notifications
          </span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] font-semibold border border-indigo-500/30">
              {unreadCount} new
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            onClick={onMarkAllAsRead}
            className="flex items-center space-x-1 text-[11px] font-medium text-gray-400 hover:text-indigo-400 transition-colors cursor-pointer"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="px-3 pt-2 pb-1 flex space-x-2 border-b border-gray-800/60 bg-gray-900/20 text-xs">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
            filter === 'ALL'
              ? 'bg-gray-800 text-gray-200'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('UNREAD')}
          className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
            filter === 'UNREAD'
              ? 'bg-gray-800 text-indigo-400'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {/* List */}
      <div className="max-h-80 overflow-y-auto divide-y divide-gray-800/40">
        {displayedNotifications.length === 0 ? (
          <div className="py-10 px-4 text-center">
            <Sparkles className="w-8 h-8 text-indigo-400/40 mx-auto mb-2" />
            <p className="text-xs font-semibold text-gray-300">All caught up!</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {filter === 'UNREAD'
                ? 'No unread notifications'
                : 'No alerts in this workspace yet'}
            </p>
          </div>
        ) : (
          displayedNotifications.map((notif) => {
            const isUnread = !notif.readAt;
            return (
              <div
                key={notif._id}
                onClick={() => {
                  if (isUnread) onMarkAsRead(notif._id);
                  if (onSelectNotification) onSelectNotification(notif);
                }}
                className={`p-3 text-left flex items-start space-x-3 transition-colors cursor-pointer ${
                  isUnread
                    ? 'bg-indigo-950/15 hover:bg-indigo-950/30'
                    : 'hover:bg-gray-800/40'
                }`}
              >
                {/* Icon */}
                <div className="p-2 rounded-xl bg-gray-900/80 border border-gray-800 shrink-0 mt-0.5">
                  {getNotificationIcon(notif.type)}
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-xs leading-relaxed ${
                      isUnread ? 'font-medium text-gray-100' : 'text-gray-400'
                    }`}
                  >
                    {notif.message}
                  </p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-[10px] text-gray-400 flex items-center space-x-1">
                      <Clock className="w-2.5 h-2.5 inline mr-1" />
                      {formatTimeAgo(notif.createdAt)}
                    </span>
                    {notif.metadata?.taskId && (
                      <span className="text-[10px] text-indigo-400/80 font-medium flex items-center">
                        View task <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                      </span>
                    )}
                  </div>
                </div>

                {/* Unread dot */}
                {isUnread && (
                  <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1.5 ring-4 ring-indigo-500/20" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
