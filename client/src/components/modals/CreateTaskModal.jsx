import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useWorkspace } from '../../context/WorkspaceContext';
import { taskService } from '../../services/taskService';
import { AlertCircle, Loader2 } from 'lucide-react';

export const CreateTaskModal = ({ isOpen, onClose, onTaskCreated, defaultProjectId, defaultStatus }) => {
  const { currentWorkspace, projects, members } = useWorkspace();

  const [projectId, setProjectId] = useState(defaultProjectId || (projects[0]?._id || ''));
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState(defaultStatus || 'TODO');
  const [priority, setPriority] = useState('MEDIUM');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Update selected project if defaultProjectId changes
  React.useEffect(() => {
    if (defaultProjectId) setProjectId(defaultProjectId);
    else if (projects.length > 0 && !projectId) setProjectId(projects[0]._id);
  }, [defaultProjectId, projects]);

  React.useEffect(() => {
    if (defaultStatus) setStatus(defaultStatus);
  }, [defaultStatus]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Task title is required');
      return;
    }

    if (!projectId) {
      setError('Please select a project for this task');
      return;
    }

    try {
      setLoading(true);
      const newTask = await taskService.createTask(projectId, {
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        assigneeId: assigneeId || null,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null
      });

      // Reset form
      setTitle('');
      setDescription('');
      setStatus('TODO');
      setPriority('MEDIUM');
      setAssigneeId('');
      setDueDate('');

      if (onTaskCreated) onTaskCreated(newTask);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Task"
      subtitle={`In ${currentWorkspace?.name || 'Workspace'}`}
      maxWidth="max-w-lg"
    >
      {error && (
        <div className="mb-4 p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl flex items-center space-x-2 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Project Selector */}
        <div>
          <label className="block text-gray-300 font-medium mb-1">Project *</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            required
            className="w-full bg-[#161c2e] border border-gray-700/80 rounded-xl px-3 py-2 text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {projects.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Task Title */}
        <div>
          <label className="block text-gray-300 font-medium mb-1">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Implement drag-and-drop Kanban columns"
            required
            className="w-full bg-[#161c2e] border border-gray-700/80 rounded-xl px-3 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-gray-300 font-medium mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add implementation details or acceptance criteria..."
            rows={3}
            className="w-full bg-[#161c2e] border border-gray-700/80 rounded-xl px-3 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Status & Priority Row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-gray-300 font-medium mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-[#161c2e] border border-gray-700/80 rounded-xl px-3 py-2 text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="DONE">Done</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-300 font-medium mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full bg-[#161c2e] border border-gray-700/80 rounded-xl px-3 py-2 text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
        </div>

        {/* Assignee & Due Date Row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-gray-300 font-medium mb-1">Assignee</label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full bg-[#161c2e] border border-gray-700/80 rounded-xl px-3 py-2 text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.name} ({m.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-300 font-medium mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-[#161c2e] border border-gray-700/80 rounded-xl px-3 py-2 text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Modal Buttons */}
        <div className="pt-3 flex items-center justify-end space-x-2 border-t border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-xl text-xs text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition-all disabled:opacity-50 cursor-pointer flex items-center space-x-1.5"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Create Task</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
