import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Kanban,
  FolderKanban,
  Users,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

export const Sidebar = () => {
  const { currentWorkspace, currentRole } = useWorkspace();

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Kanban Board', path: '/kanban', icon: Kanban },
    { name: 'Projects', path: '/projects', icon: FolderKanban },
    { name: 'Members', path: '/members', icon: Users }
  ];

  return (
    <aside className="w-56 shrink-0 border-r border-gray-800/80 bg-[#090d16] flex flex-col justify-between select-none">
      <div>
        {/* Brand Header */}
        <div className="h-14 flex items-center px-4 border-b border-gray-800/80 space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm tracking-tight text-white">DevCollab</span>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
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
    </aside>
  );
};
