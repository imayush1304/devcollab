import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useWorkspace } from '../../context/WorkspaceContext';
import { projectService } from '../../services/projectService';
import { AlertCircle, Loader2 } from 'lucide-react';

export const CreateProjectModal = ({ isOpen, onClose, onProjectCreated }) => {
  const { currentWorkspace, refreshProjects } = useWorkspace();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Project name is required');
      return;
    }

    try {
      setLoading(true);
      const newProject = await projectService.createProject(currentWorkspace._id, {
        name: name.trim(),
        description: description.trim()
      });

      setName('');
      setDescription('');
      await refreshProjects();
      if (onProjectCreated) onProjectCreated(newProject);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Project"
      subtitle={`In workspace: ${currentWorkspace?.name || ''}`}
      maxWidth="max-w-md"
    >
      {error && (
        <div className="mb-4 p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl flex items-center space-x-2 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block text-gray-300 font-medium mb-1">Project Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Core API Service"
            required
            className="w-full bg-[#161c2e] border border-gray-700/80 rounded-xl px-3 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-gray-300 font-medium mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="High-level goals and objectives..."
            rows={3}
            className="w-full bg-[#161c2e] border border-gray-700/80 rounded-xl px-3 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

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
            <span>Create Project</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
