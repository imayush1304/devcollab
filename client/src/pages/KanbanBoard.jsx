import React, { useState, useEffect, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners
} from '@dnd-kit/core';
import { KanbanColumn } from '../components/kanban/KanbanColumn';
import { TaskCard } from '../components/kanban/TaskCard';
import { TaskDetailModal } from '../components/modals/TaskDetailModal';
import { CreateTaskModal } from '../components/modals/CreateTaskModal';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { taskService } from '../services/taskService';
import {
  Search,
  Filter,
  Plus,
  Loader2,
  FolderKanban,
  AlertCircle
} from 'lucide-react';

export const KanbanBoard = () => {
  const { projects, members, isViewer } = useWorkspace();
  const { user } = useAuth();
  const { socket } = useSocket();

  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState('ALL');

  // Modals state
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalStatus, setCreateModalStatus] = useState('TODO');
  const [activeDragTask, setActiveDragTask] = useState(null);
  const [errorToast, setErrorToast] = useState('');

  // Sensors for drag-and-drop (Calibrated for desktop mouse and mobile touch screens)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6 // 6px drag distance before activating to preserve clicks
      }
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // 200ms touch press before drag starts so standard mobile page scrolling is smooth
        tolerance: 6
      }
    })
  );

  // Set default selected project
  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0]._id);
    }
  }, [projects, selectedProjectId]);

  // Fetch tasks whenever selected project changes
  const loadTasks = async () => {
    if (!selectedProjectId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await taskService.getProjectTasks(selectedProjectId);
      setTasks(res.data?.tasks || res.data || []);
    } catch (err) {
      console.error('Failed to load project tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [selectedProjectId]);

  // Real-time Socket.IO synchronization for task mutations
  useEffect(() => {
    if (!socket) return;

    const handleTaskCreated = (newTask) => {
      const taskProjId = newTask.projectId?._id || newTask.projectId;
      if (
        taskProjId &&
        selectedProjectId &&
        taskProjId.toString() === selectedProjectId.toString()
      ) {
        setTasks((prev) => {
          if (prev.some((t) => t._id === newTask._id)) {
            return prev.map((t) => (t._id === newTask._id ? newTask : t));
          }
          return [newTask, ...prev];
        });
      }
    };

    const handleTaskUpdated = (updatedTask) => {
      const taskProjId = updatedTask.projectId?._id || updatedTask.projectId;
      if (
        taskProjId &&
        selectedProjectId &&
        taskProjId.toString() === selectedProjectId.toString()
      ) {
        setTasks((prev) => {
          const exists = prev.some((t) => t._id === updatedTask._id);
          if (exists) {
            return prev.map((t) =>
              t._id === updatedTask._id ? { ...t, ...updatedTask } : t
            );
          }
          return [updatedTask, ...prev];
        });
      } else {
        setTasks((prev) => prev.filter((t) => t._id !== updatedTask._id));
      }
    };

    const handleTaskDeleted = ({ taskId }) => {
      setTasks((prev) => prev.filter((t) => t._id !== taskId));
      if (selectedTaskId === taskId) {
        setSelectedTaskId(null);
      }
    };

    socket.on('task:created', handleTaskCreated);
    socket.on('task:updated', handleTaskUpdated);
    socket.on('task:deleted', handleTaskDeleted);

    return () => {
      socket.off('task:created', handleTaskCreated);
      socket.off('task:updated', handleTaskUpdated);
      socket.off('task:deleted', handleTaskDeleted);
    };
  }, [socket, selectedProjectId, selectedTaskId]);

  // Filter tasks in memory for instant responsiveness
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Search title
      if (
        searchQuery &&
        !t.title.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      // Priority filter
      if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) {
        return false;
      }
      // Assignee filter
      if (assigneeFilter === 'ME') {
        if (t.assigneeId?._id !== user?.id) return false;
      } else if (assigneeFilter === 'UNASSIGNED') {
        if (t.assigneeId != null) return false;
      } else if (assigneeFilter !== 'ALL') {
        if (t.assigneeId?._id !== assigneeFilter) return false;
      }
      return true;
    });
  }, [tasks, searchQuery, priorityFilter, assigneeFilter, user?.id]);

  // Group tasks by Kanban status columns
  const columns = useMemo(() => {
    return {
      TODO: filteredTasks.filter((t) => t.status === 'TODO'),
      IN_PROGRESS: filteredTasks.filter((t) => t.status === 'IN_PROGRESS'),
      DONE: filteredTasks.filter((t) => t.status === 'DONE')
    };
  }, [filteredTasks]);

  // Drag start
  const handleDragStart = (event) => {
    if (isViewer) return;
    const task = tasks.find((t) => t._id === event.active.id);
    setActiveDragTask(task || null);
  };

  // Drag end - Optimistic update with automatic rollback on error
  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveDragTask(null);

    if (isViewer || !over) return;

    const taskId = active.id;
    // Over can be column id directly ('TODO', 'IN_PROGRESS', 'DONE') or another task in that column
    let destinationStatus = over.id;

    if (!['TODO', 'IN_PROGRESS', 'DONE'].includes(destinationStatus)) {
      // Find the status of the target task
      const targetTask = tasks.find((t) => t._id === over.id);
      if (targetTask) {
        destinationStatus = targetTask.status;
      } else {
        return;
      }
    }

    const currentTask = tasks.find((t) => t._id === taskId);
    if (!currentTask || currentTask.status === destinationStatus) return;

    // Snapshot previous state for rollback
    const previousTasks = [...tasks];

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t._id === taskId ? { ...t, status: destinationStatus } : t
      )
    );

    try {
      await taskService.updateTask(taskId, {
        status: destinationStatus,
        version: currentTask.version
      });
    } catch (err) {
      // Rollback on rejection (e.g. version conflict or permissions)
      setTasks(previousTasks);
      setErrorToast(err.message || 'Failed to update task status');
      setTimeout(() => setErrorToast(''), 4000);
    }
  };

  // Accessible menu status changer
  const handleStatusChange = async (taskId, newStatus) => {
    if (isViewer) return;
    const currentTask = tasks.find((t) => t._id === taskId);
    if (!currentTask || currentTask.status === newStatus) return;

    const previousTasks = [...tasks];
    setTasks((prev) =>
      prev.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t))
    );

    try {
      await taskService.updateTask(taskId, {
        status: newStatus,
        version: currentTask.version
      });
    } catch (err) {
      setTasks(previousTasks);
      setErrorToast(err.message || 'Failed to update task status');
      setTimeout(() => setErrorToast(''), 4000);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top Filter and Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-800/80">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {/* Project Switcher */}
          <div className="flex items-center space-x-2 bg-gray-900/80 border border-gray-800 rounded-xl px-2.5 sm:px-3 py-1.5 text-xs">
            <FolderKanban className="w-4 h-4 text-indigo-400 shrink-0" />
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-transparent text-gray-200 font-semibold focus:outline-none cursor-pointer max-w-[120px] sm:max-w-none truncate"
            >
              {projects.map((p) => (
                <option key={p._id} value={p._id} className="bg-[#0f1422] text-gray-200">
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="bg-[#131828] border border-gray-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full sm:w-56"
            />
          </div>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-[#131828] border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-gray-300 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>

          {/* Assignee Filter */}
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="bg-[#131828] border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-gray-300 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Assignees</option>
            <option value="ME">Assigned to Me</option>
            <option value="UNASSIGNED">Unassigned</option>
            {members.map((m) => (
              <option key={m.user.id} value={m.user.id}>
                {m.user.name}
              </option>
            ))}
          </select>
        </div>

        {/* Action Button */}
        {!isViewer && (
          <button
            onClick={() => {
              setCreateModalStatus('TODO');
              setCreateModalOpen(true);
            }}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Task</span>
          </button>
        )}
      </div>

      {/* Error Alert Banner */}
      {errorToast && (
        <div className="mb-4 p-3 bg-rose-950/50 border border-rose-800/80 rounded-xl flex items-center space-x-2 text-rose-300 text-xs animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorToast}</span>
        </div>
      )}

      {/* Main Kanban Columns Area */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center space-x-2 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          <span className="text-xs">Loading board tasks...</span>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <FolderKanban className="w-12 h-12 text-gray-600 mb-3" />
          <h3 className="text-base font-semibold text-gray-200">No Projects in Workspace</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm">
            Create a project first to start tracking tasks with Kanban boards.
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth">
            <div className="flex items-start space-x-4 sm:space-x-6 min-w-max pb-2">
              <KanbanColumn
                id="TODO"
                title="To Do"
                tasks={columns.TODO}
                onTaskClick={(t) => setSelectedTaskId(t._id)}
                onAddTask={(status) => {
                  setCreateModalStatus(status);
                  setCreateModalOpen(true);
                }}
                onStatusChange={handleStatusChange}
                isViewer={isViewer}
              />

              <KanbanColumn
                id="IN_PROGRESS"
                title="In Progress"
                tasks={columns.IN_PROGRESS}
                onTaskClick={(t) => setSelectedTaskId(t._id)}
                onAddTask={(status) => {
                  setCreateModalStatus(status);
                  setCreateModalOpen(true);
                }}
                onStatusChange={handleStatusChange}
                isViewer={isViewer}
              />

              <KanbanColumn
                id="DONE"
                title="Done"
                tasks={columns.DONE}
                onTaskClick={(t) => setSelectedTaskId(t._id)}
                onAddTask={(status) => {
                  setCreateModalStatus(status);
                  setCreateModalOpen(true);
                }}
                onStatusChange={handleStatusChange}
                isViewer={isViewer}
              />
            </div>
          </div>

          {/* Active Drag Overlay */}
          <DragOverlay>
            {activeDragTask ? (
              <div className="w-80 opacity-90 scale-105 rotate-2">
                <TaskCard
                  task={activeDragTask}
                  onClick={() => {}}
                  isViewer={isViewer}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Task Detail Modal */}
      <TaskDetailModal
        isOpen={!!selectedTaskId}
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onTaskUpdated={loadTasks}
        onTaskDeleted={loadTasks}
      />

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        defaultProjectId={selectedProjectId}
        defaultStatus={createModalStatus}
        onTaskCreated={loadTasks}
      />
    </div>
  );
};
