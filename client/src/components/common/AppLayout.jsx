import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { CreateWorkspaceModal } from '../modals/CreateWorkspaceModal';
import { CreateTaskModal } from '../modals/CreateTaskModal';
import { TaskDetailModal } from '../modals/TaskDetailModal';
import { useWorkspace } from '../../context/WorkspaceContext';

export const AppLayout = () => {
  const { currentWorkspace, loading } = useWorkspace();

  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [notificationTaskId, setNotificationTaskId] = useState(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[#07090e] text-gray-200 overflow-hidden">
      {/* Sidebar (Desktop permanent + Mobile slide-over drawer) */}
      <Sidebar
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Navbar
          onOpenCreateWorkspace={() => setCreateWorkspaceOpen(true)}
          onOpenCreateTask={() => setCreateTaskOpen(true)}
          onSelectNotificationTask={(taskId) => setNotificationTaskId(taskId)}
          onToggleMobileMenu={() => setMobileSidebarOpen((prev) => !prev)}
        />

        <main className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6">
          <Outlet />
        </main>
      </div>

      {/* Global Modals */}
      <CreateWorkspaceModal
        isOpen={createWorkspaceOpen}
        onClose={() => setCreateWorkspaceOpen(false)}
      />

      <CreateTaskModal
        isOpen={createTaskOpen}
        onClose={() => setCreateTaskOpen(false)}
      />

      {/* Task Details Modal from Notification Click */}
      <TaskDetailModal
        isOpen={Boolean(notificationTaskId)}
        onClose={() => setNotificationTaskId(null)}
        taskId={notificationTaskId}
      />
    </div>
  );
};
