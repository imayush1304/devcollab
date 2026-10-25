import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Kanban,
  FolderKanban,
  Users,
  MessageSquare,
  Sparkles,
  ShieldCheck,
  X
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

export const Sidebar = ({ isOpen = false, onClose = () => {} }) => {
  const { currentWorkspace, currentRole } = useWorkspace();

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Kanban Board', path: '/kanban', icon: Kanban },
    { name: 'Projects', path: '/projects', icon: FolderKanban },
    { name: 'Messages', path: '/messages', icon: MessageSquare },
    { name: 'Members', path: '/members', icon: Users }
  ];

  const renderNavContent = (isMobile = false) => (
    <>
      <div>
        {/* Brand Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-gray-800/80">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-sm tracking-tight text-white">DevCollab</span>
          </div>

          {/* Close button on mobile drawer */}
          {isMobile && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/60 transition-colors"
              aria-label="Close Sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => {
                  if (isMobile) onClose();
                }}
                className={({ isActive }) =>
                  `flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600/15 text-indigo-400 font-semibold border border-indigo-500/30 shadow-sm'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer Info Badge */}
      <div className="p-3 border-t border-gray-800/80">
        <div className="p-2.5 rounded-xl bg-gray-900/60 border border-gray-800 text-[11px] text-gray-400">
          <div className="flex items-center space-x-1.5 text-indigo-400 font-semibold mb-0.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="capitalize">{currentRole || 'Member'} Mode</span>
          </div>
          <p className="truncate text-gray-500 text-[10px]">
            {currentWorkspace?.name || 'No workspace selected'}
          </p>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* 1. Desktop Sidebar (Always visible on md screens and up) */}
      <aside className="hidden md:flex w-56 shrink-0 border-r border-gray-800/80 bg-[#090d16] flex-col justify-between select-none">
        {renderNavContent(false)}
      </aside>

      {/* 2. Mobile Slide-Over Drawer with Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden select-none">
          {/* Backdrop blur overlay */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={onClose}
          />

          {/* Drawer Content */}
          <div className="fixed inset-y-0 left-0 w-64 bg-[#090d16] border-r border-gray-800/80 shadow-2xl flex flex-col justify-between z-50 animate-in slide-in-from-left duration-250">
            {renderNavContent(true)}
          </div>
        </div>
      )}
    </>
  );
};
