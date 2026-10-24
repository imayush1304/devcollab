import React from 'react';
import { AlertCircle, ArrowUp, ArrowDown, Minus, CheckCircle, Clock, CircleDot } from 'lucide-react';

export const PriorityBadge = ({ priority }) => {
  const configs = {
    LOW: {
      label: 'Low',
      bg: 'bg-slate-800/60',
      text: 'text-slate-300',
      border: 'border-slate-700/60',
      icon: <ArrowDown className="w-3 h-3 text-slate-400" />
    },
    MEDIUM: {
      label: 'Medium',
      bg: 'bg-blue-950/40',
      text: 'text-blue-300',
      border: 'border-blue-800/50',
      icon: <Minus className="w-3 h-3 text-blue-400" />
    },
    HIGH: {
      label: 'High',
      bg: 'bg-amber-950/40',
      text: 'text-amber-300',
      border: 'border-amber-800/50',
      icon: <ArrowUp className="w-3 h-3 text-amber-400" />
    },
    URGENT: {
      label: 'Urgent',
      bg: 'bg-rose-950/50',
      text: 'text-rose-300',
      border: 'border-rose-800/60',
      icon: <AlertCircle className="w-3 h-3 text-rose-400 animate-pulse" />
    }
  };

  const config = configs[priority] || configs.MEDIUM;

  return (
    <span
      className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${config.bg} ${config.text} ${config.border}`}
    >
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
};

export const StatusBadge = ({ status }) => {
  const configs = {
    TODO: {
      label: 'To Do',
      bg: 'bg-slate-800/60',
      text: 'text-slate-300',
      border: 'border-slate-700/60',
      icon: <CircleDot className="w-3 h-3 text-slate-400" />
    },
    IN_PROGRESS: {
      label: 'In Progress',
      bg: 'bg-indigo-950/50',
      text: 'text-indigo-300',
      border: 'border-indigo-800/60',
      icon: <Clock className="w-3 h-3 text-indigo-400" />
    },
    DONE: {
      label: 'Done',
      bg: 'bg-emerald-950/50',
      text: 'text-emerald-300',
      border: 'border-emerald-800/60',
      icon: <CheckCircle className="w-3 h-3 text-emerald-400" />
    }
  };

  const config = configs[status] || configs.TODO;

  return (
    <span
      className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${config.bg} ${config.text} ${config.border}`}
    >
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
};

export const RoleBadge = ({ role }) => {
  const configs = {
    Admin: 'bg-purple-950/50 text-purple-300 border-purple-800/50',
    Member: 'bg-indigo-950/50 text-indigo-300 border-indigo-800/50',
    Viewer: 'bg-gray-800/60 text-gray-400 border-gray-700/50'
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${
        configs[role] || configs.Viewer
      }`}
    >
      {role}
    </span>
  );
};
