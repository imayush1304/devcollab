import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../context/WorkspaceContext';
import { projectService } from '../services/projectService';
import { CreateProjectModal } from '../components/modals/CreateProjectModal';
import { Avatar } from '../components/common/Avatar';
import {
  FolderKanban,
  Plus,
  Trash2,
  Kanban,
  CheckCircle2,
  Clock,
  Layers,
  Loader2
} from 'lucide-react';

export const Projects = () => {
  const { currentWorkspace, projects, refreshProjects, isAdmin, isViewer } = useWorkspace();
  const navigate = useNavigate();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (projectId, projectName) => {
    if (!isAdmin) return;
    if (!window.confirm(`Are you sure you want to delete project "${projectName}" and its tasks?`)) return;

    try {
      setDeletingId(projectId);
      await projectService.deleteProject(projectId);
      await refreshProjects();
    } catch (err) {
      alert(err.message || 'Failed to delete project');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-800/80">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Projects</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Projects organized under <span className="text-indigo-300 font-medium">{currentWorkspace?.name}</span>
          </p>
        </div>

        {!isViewer && (
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </button>
        )}
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[#0e1322] border border-gray-800 text-center flex flex-col items-center justify-center">
          <FolderKanban className="w-12 h-12 text-gray-600 mb-3" />
          <h3 className="text-base font-semibold text-gray-200">No projects yet</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm">
            Create your first project to organize tasks and manage your sprint board.
          </p>
          {!isViewer && (
            <button
              onClick={() => setCreateModalOpen(true)}
              className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
            >
              + Create First Project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((p) => {
            const stats = p.stats || { total: 0, done: 0, completionPercentage: 0 };
            return (
              <div
                key={p._id}
                className="p-5 rounded-2xl bg-[#0e1322] border border-gray-800/90 hover:border-gray-700 transition-all flex flex-col justify-between shadow-lg hover:shadow-2xl"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="w-9 h-9 rounded-xl bg-indigo-950/60 border border-indigo-800/60 flex items-center justify-center text-indigo-400 mb-3">
                      <FolderKanban className="w-5 h-5" />
                    </div>

                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(p._id, p.name)}
                        disabled={deletingId === p._id}
                        className="text-gray-500 hover:text-rose-400 p-1 rounded-lg hover:bg-rose-950/20 transition-colors cursor-pointer"
                        title="Delete project"
                      >
                        {deletingId === p._id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold text-gray-100">{p.name}</h3>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2 min-h-[32px]">
                    {p.description || <span className="italic text-gray-600">No description</span>}
                  </p>
                </div>

                {/* Progress Bar & Stats */}
                <div className="mt-5 pt-4 border-t border-gray-800/80 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400 font-medium">Completion</span>
                    <span className="text-indigo-400 font-semibold">{stats.completionPercentage}%</span>
                  </div>

                  <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${stats.completionPercentage}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                    <div className="flex items-center space-x-1">
                      <Layers className="w-3.5 h-3.5 text-gray-500" />
                      <span>{stats.total} Tasks</span>
                    </div>

                    <button
                      onClick={() => navigate('/kanban')}
                      className="inline-flex items-center space-x-1 text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                    >
                      <Kanban className="w-3.5 h-3.5" />
                      <span>Open Board</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateProjectModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onProjectCreated={refreshProjects}
      />
    </div>
  );
};
