import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Avatar } from '../common/Avatar';
import { PriorityBadge, StatusBadge } from '../common/Badge';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { taskService } from '../../services/taskService';
import { commentService } from '../../services/commentService';
import {
  Calendar,
  Trash2,
  AlertCircle,
  Loader2,
  Clock,
  Sparkles,
  Layers,
  MessageSquare,
  Activity,
  Send,
  UserCheck,
  CheckCircle2
} from 'lucide-react';

export const TaskDetailModal = ({
  isOpen,
  onClose,
  taskId,
  onTaskUpdated,
  onTaskDeleted
}) => {
  const { members, isAdmin, isViewer } = useWorkspace();
  const { user } = useAuth();
  const { socket } = useSocket();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'comments' | 'activities'
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  // Comments state
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  // Activities state
  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Fetch task, comments, and activities whenever modal opens
  useEffect(() => {
    if (!isOpen || !taskId) {
      setTask(null);
      setComments([]);
      setActivities([]);
      setError('');
      setActiveTab('overview');
      return;
    }

    const fetchAllData = async () => {
      try {
        setLoading(true);
        setError('');
        const [taskData, commentsData, activitiesData] = await Promise.all([
          taskService.getTask(taskId),
          commentService.getTaskComments(taskId).catch(() => []),
          commentService.getTaskActivities(taskId).catch(() => [])
        ]);

        setTask(taskData);
        setComments(commentsData || []);
        setActivities(activitiesData || []);
      } catch (err) {
        setError(err.message || 'Failed to load task details');
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [isOpen, taskId]);

  // Real-time Socket.IO synchronization for comments and task changes
  useEffect(() => {
    if (!socket || !isOpen || !taskId) return;

    const handleCommentAdded = (newComment) => {
      const commentTaskId = newComment.taskId?._id || newComment.taskId;
      if (commentTaskId && commentTaskId.toString() === taskId.toString()) {
        setComments((prev) => {
          if (prev.some((c) => c._id === newComment._id)) return prev;
          return [...prev, newComment];
        });
        // Also fetch fresh activity timeline quietly
        commentService
          .getTaskActivities(taskId)
          .then((fresh) => setActivities(fresh || []))
          .catch(() => {});
      }
    };

    const handleTaskUpdated = (updatedTask) => {
      if (updatedTask._id === taskId) {
        setTask((prev) => (prev ? { ...prev, ...updatedTask } : updatedTask));
      }
    };

    const handleTaskDeleted = ({ taskId: deletedId }) => {
      if (deletedId === taskId) {
        onClose();
      }
    };

    socket.on('comment:added', handleCommentAdded);
    socket.on('task:updated', handleTaskUpdated);
    socket.on('task:deleted', handleTaskDeleted);

    return () => {
      socket.off('comment:added', handleCommentAdded);
      socket.off('task:updated', handleTaskUpdated);
      socket.off('task:deleted', handleTaskDeleted);
    };
  }, [socket, isOpen, taskId, onClose]);

  const handleUpdateField = async (field, value) => {
    if (isViewer || !task) return;

    try {
      setSaving(true);
      setError('');
      const updated = await taskService.updateTask(task._id, {
        [field]: value,
        version: task.version
      });
      setTask(updated);

      // Refresh activity timeline
      const freshActivities = await commentService.getTaskActivities(task._id);
      setActivities(freshActivities || []);

      if (onTaskUpdated) onTaskUpdated(updated);
    } catch (err) {
      setError(err.message || 'Failed to update task');
    } finally {
      setSaving(false);
    }
  };

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!commentBody.trim() || isViewer || !task) return;

    try {
      setPostingComment(true);
      setError('');
      const newComment = await commentService.createComment(
        task._id,
        commentBody.trim()
      );
      setComments((prev) => [...prev, newComment]);
      setCommentBody('');

      // Refresh activities
      const freshActivities = await commentService.getTaskActivities(task._id);
      setActivities(freshActivities || []);
    } catch (err) {
      setError(err.message || 'Failed to post comment');
    } finally {
      setPostingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!task) return;
    if (!window.confirm('Are you sure you want to delete this comment?')) return;

    try {
      await commentService.deleteComment(task._id, commentId);
      setComments((prev) => prev.filter((c) => c._id !== commentId));
    } catch (err) {
      setError(err.message || 'Failed to delete comment');
    }
  };

  const handleDeleteTask = async () => {
    if (!task) return;
    if (!window.confirm(`Are you sure you want to delete "${task.title}"?`)) return;

    try {
      setDeleting(true);
      await taskService.deleteTask(task._id);
      if (onTaskDeleted) onTaskDeleted(task._id);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to delete task');
    } finally {
      setDeleting(false);
    }
  };

  const canDeleteTask = isAdmin || (task && task.createdBy?._id === user?.id);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={task?.title || 'Task Details'}
      subtitle={task?.projectId?.name ? `Project: ${task.projectId.name}` : ''}
      maxWidth="max-w-2xl"
    >
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center space-y-2">
          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
          <span className="text-xs text-gray-400">Loading task details...</span>
        </div>
      ) : error && !task ? (
        <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-xl flex items-center space-x-2 text-rose-300 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : task ? (
        <div className="space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl flex items-center space-x-2 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex items-center space-x-1 border-b border-gray-800 pb-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Overview</span>
            </button>

            <button
              onClick={() => setActiveTab('comments')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'comments'
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Comments</span>
              <span className="px-1.5 py-0.2 rounded-full bg-gray-800 text-[10px] text-gray-300">
                {comments.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('activities')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'activities'
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Activity History</span>
            </button>
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Properties Grid */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-gray-900/50 border border-gray-800/80">
                {/* Status */}
                <div>
                  <span className="text-gray-400 block mb-1 text-[11px] font-medium">Status</span>
                  {isViewer ? (
                    <StatusBadge status={task.status} />
                  ) : (
                    <select
                      value={task.status}
                      onChange={(e) => handleUpdateField('status', e.target.value)}
                      disabled={saving}
                      className="w-full bg-[#161c2e] border border-gray-700/80 rounded-lg px-2.5 py-1.5 text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="TODO">To Do</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="DONE">Done</option>
                    </select>
                  )}
                </div>

                {/* Priority */}
                <div>
                  <span className="text-gray-400 block mb-1 text-[11px] font-medium">Priority</span>
                  {isViewer ? (
                    <PriorityBadge priority={task.priority} />
                  ) : (
                    <select
                      value={task.priority}
                      onChange={(e) => handleUpdateField('priority', e.target.value)}
                      disabled={saving}
                      className="w-full bg-[#161c2e] border border-gray-700/80 rounded-lg px-2.5 py-1.5 text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  )}
                </div>

                {/* Assignee */}
                <div>
                  <span className="text-gray-400 block mb-1 text-[11px] font-medium">Assignee</span>
                  {isViewer ? (
                    <div className="flex items-center space-x-2">
                      <Avatar user={task.assigneeId} size="sm" />
                      <span className="text-gray-200">{task.assigneeId?.name || 'Unassigned'}</span>
                    </div>
                  ) : (
                    <select
                      value={task.assigneeId?._id || ''}
                      onChange={(e) => handleUpdateField('assigneeId', e.target.value || null)}
                      disabled={saving}
                      className="w-full bg-[#161c2e] border border-gray-700/80 rounded-lg px-2.5 py-1.5 text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">Unassigned</option>
                      {members.map((m) => (
                        <option key={m.user.id} value={m.user.id}>
                          {m.user.name} ({m.role})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Due Date */}
                <div>
                  <span className="text-gray-400 block mb-1 text-[11px] font-medium">Due Date</span>
                  {isViewer ? (
                    <div className="flex items-center space-x-1.5 text-gray-300">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <span>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}</span>
                    </div>
                  ) : (
                    <input
                      type="date"
                      value={task.dueDate ? task.dueDate.substring(0, 10) : ''}
                      onChange={(e) =>
                        handleUpdateField(
                          'dueDate',
                          e.target.value ? new Date(e.target.value).toISOString() : null
                        )
                      }
                      disabled={saving}
                      className="w-full bg-[#161c2e] border border-gray-700/80 rounded-lg px-2.5 py-1 text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  )}
                </div>
              </div>

              {/* Description Section */}
              <div>
                <h4 className="text-xs font-semibold text-gray-300 mb-1.5">Description</h4>
                <div className="p-3 bg-gray-900/40 border border-gray-800 rounded-xl text-gray-300 whitespace-pre-wrap leading-relaxed min-h-[70px]">
                  {task.description || (
                    <span className="text-gray-500 italic">No description provided.</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: COMMENTS THREAD */}
          {activeTab === 'comments' && (
            <div className="space-y-4">
              {/* Comments Feed */}
              <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
                {comments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-xs">
                    <MessageSquare className="w-8 h-8 text-gray-600 mx-auto mb-2 opacity-60" />
                    <span>No comments yet. Start the conversation!</span>
                  </div>
                ) : (
                  comments.map((c) => {
                    const isAuthor = c.authorId?._id === user?.id;
                    const canDelete = isAuthor || isAdmin;

                    return (
                      <div
                        key={c._id}
                        className="p-3 rounded-xl bg-gray-900/50 border border-gray-800/80 space-y-1.5 hover:border-gray-700 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Avatar user={c.authorId} size="sm" />
                            <span className="font-semibold text-gray-200">
                              {c.authorId?.name || 'Collaborator'}
                            </span>
                            <span className="text-[10px] text-gray-500">
                              {new Date(c.createdAt).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>

                          {canDelete && (
                            <button
                              onClick={() => handleDeleteComment(c._id)}
                              className="text-gray-500 hover:text-rose-400 p-1 transition-colors cursor-pointer"
                              title="Delete comment"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        <p className="text-gray-300 pl-8 whitespace-pre-wrap leading-relaxed">
                          {c.body}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add Comment Input */}
              {!isViewer ? (
                <form onSubmit={handlePostComment} className="flex items-center space-x-2 pt-2 border-t border-gray-800">
                  <input
                    type="text"
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    placeholder="Write a comment..."
                    disabled={postingComment}
                    className="flex-1 bg-[#161c2e] border border-gray-700/80 rounded-xl px-3 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={postingComment || !commentBody.trim()}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all disabled:opacity-40 cursor-pointer flex items-center space-x-1"
                  >
                    {postingComment ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>Send</span>
                  </button>
                </form>
              ) : (
                <p className="text-[11px] text-gray-500 italic text-center pt-2 border-t border-gray-800">
                  Viewer role is read-only; commenting is disabled.
                </p>
              )}
            </div>
          )}

          {/* TAB 3: ACTIVITY HISTORY TIMELINE */}
          {activeTab === 'activities' && (
            <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
              {activities.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-xs">
                  <Activity className="w-8 h-8 text-gray-600 mx-auto mb-2 opacity-60" />
                  <span>No recorded activities for this task.</span>
                </div>
              ) : (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-800">
                  {activities.map((act) => {
                    const icons = {
                      CREATED: <Sparkles className="w-3 h-3 text-indigo-400" />,
                      ASSIGNED: <UserCheck className="w-3 h-3 text-blue-400" />,
                      STATUS_CHANGED: <Clock className="w-3 h-3 text-emerald-400" />,
                      PRIORITY_CHANGED: <AlertCircle className="w-3 h-3 text-amber-400" />,
                      DUE_DATE_CHANGED: <Calendar className="w-3 h-3 text-purple-400" />,
                      COMMENT_ADDED: <MessageSquare className="w-3 h-3 text-pink-400" />
                    };

                    const actionText = act.action.toLowerCase().replace(/_/g, ' ');

                    return (
                      <div key={act._id} className="relative flex items-start space-x-2.5 text-xs">
                        <span className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-[#0f1422] border border-gray-700 flex items-center justify-center">
                          {icons[act.action] || <CheckCircle2 className="w-2.5 h-2.5 text-gray-400" />}
                        </span>
                        <div>
                          <p className="text-gray-300">
                            <span className="font-semibold text-gray-200">
                              {act.actorId?.name || 'User'}
                            </span>{' '}
                            <span className="text-gray-400">{actionText}</span>
                            {act.metadata?.from && act.metadata?.to && (
                              <span className="text-indigo-300 font-mono text-[11px] ml-1">
                                {act.metadata.from} → {act.metadata.to}
                              </span>
                            )}
                          </p>
                          <span className="text-[10px] text-gray-500">
                            {new Date(act.createdAt).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Metadata Footer */}
          <div className="pt-3 border-t border-gray-800 flex items-center justify-between text-[11px] text-gray-500">
            <div>
              Created by <span className="text-gray-400">{task.createdBy?.name || 'User'}</span> on{' '}
              {new Date(task.createdAt).toLocaleDateString()}
            </div>

            {canDeleteTask && (
              <button
                onClick={handleDeleteTask}
                disabled={deleting}
                className="flex items-center space-x-1 text-rose-400 hover:text-rose-300 p-1.5 rounded-lg hover:bg-rose-950/30 transition-colors cursor-pointer"
              >
                {deleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Delete Task</span>
              </button>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
};
