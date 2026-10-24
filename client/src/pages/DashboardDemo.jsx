import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, User, ShieldCheck, Layers, Kanban, Bell, CheckCircle } from 'lucide-react';

export const DashboardDemo = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#07090e] text-gray-200">
      {/* Top Navbar */}
      <header className="border-b border-gray-800/80 bg-[#0f1422]/70 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="font-bold text-white text-base">DC</span>
            </div>
            <span className="text-lg font-bold tracking-tight text-white">DevCollab</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              Auth Active
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3 bg-gray-900/60 border border-gray-800 px-3 py-1.5 rounded-xl">
              <div className="w-7 h-7 rounded-lg bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-semibold text-xs border border-indigo-500/30">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="text-xs hidden sm:block">
                <p className="font-medium text-gray-200">{user?.name}</p>
                <p className="text-gray-500">{user?.email}</p>
              </div>
            </div>

            <button
              onClick={logout}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white bg-gray-800/60 hover:bg-gray-800 border border-gray-700/60 rounded-xl transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Welcome Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950/40 via-purple-950/20 to-transparent border border-indigo-500/20 p-8 mb-8">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-3">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>Day 2 Complete: JWT Authentication & Validation Verified</span>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Welcome back, {user?.name}!
            </h1>
            <p className="mt-2 text-sm text-gray-300 leading-relaxed">
              Your authentication session is securely established via HttpOnly cookies and Bearer tokens. Password hashing, duplicate checks, and route protection are active.
            </p>
          </div>
        </div>

        {/* User Session Inspection Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-[#0f1422] border border-gray-800/80 rounded-2xl p-6">
            <div className="flex items-center space-x-3 text-indigo-400 mb-2">
              <User className="w-5 h-5" />
              <h3 className="text-sm font-semibold text-gray-200">Current User Identity</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4">Resolved securely via <code className="text-indigo-300">GET /api/auth/me</code></p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-gray-800/60">
                <span className="text-gray-400">Name:</span>
                <span className="text-gray-200 font-medium">{user?.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800/60">
                <span className="text-gray-400">Email:</span>
                <span className="text-gray-200 font-medium">{user?.email}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-400">User ID:</span>
                <span className="text-gray-400 font-mono text-[11px] truncate max-w-[140px]">{user?.id}</span>
              </div>
            </div>
          </div>

          <div className="bg-[#0f1422] border border-gray-800/80 rounded-2xl p-6">
            <div className="flex items-center space-x-3 text-emerald-400 mb-2">
              <CheckCircle className="w-5 h-5" />
              <h3 className="text-sm font-semibold text-gray-200">Security Architecture</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4">Production-grade protection</p>
            <ul className="space-y-2 text-xs text-gray-300">
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Bcrypt Salt Rounds: 12</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>HttpOnly & SameSite Cookie Protection</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Zod Strict Schema Validation (422)</span>
              </li>
            </ul>
          </div>

          <div className="bg-[#0f1422] border border-gray-800/80 rounded-2xl p-6">
            <div className="flex items-center space-x-3 text-purple-400 mb-2">
              <Layers className="w-5 h-5" />
              <h3 className="text-sm font-semibold text-gray-200">Upcoming Module (Day 3–4)</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4">Workspaces, Projects & Kanban</p>
            <ul className="space-y-2 text-xs text-gray-300">
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                <span>Workspace creation & role management</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                <span>Projects with task metrics</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                <span>Kanban drag-and-drop boards</span>
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
};
