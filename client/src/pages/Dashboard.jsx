import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAuth } from '../context/AuthContext';
import { workspaceService } from '../services/workspaceService';
import { PriorityBadge, StatusBadge } from '../components/common/Badge';
import { Avatar } from '../components/common/Avatar';
import { TaskDetailModal } from '../components/modals/TaskDetailModal';
import {
  FolderKanban,
  AlertTriangle,
  UserCheck,
  Activity,
  Layers,
  Loader2
} from 'lucide-react';

export const Dashboard = () => {
  const { currentWorkspace } = useWorkspace();

  const [metrics, setMetrics] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  const loadDashboardData = async () => {
    if (!currentWorkspace?._id) return;

    try {
      setLoading(true);
      const [metricsData, activityRes] = await Promise.all([
        workspaceService.getDashboardMetrics(currentWorkspace._id),
        workspaceService.getActivities(currentWorkspace._id, { limit: 6 })
      ]);
      setMetrics(metricsData);
      setActivities(activityRes.data || []);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [currentWorkspace?._id]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center space-x-2 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        <span className="text-xs">Computing workspace metrics...</span>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Projects',
      value: metrics?.totalProjects || 0,
      icon: FolderKanban,
      color: 'text-indigo-400',
      bg: 'bg-indigo-950/30 border-indigo-800/40'
    },
    {
      label: 'Total Tasks',
      value: metrics?.totalTasks || 0,
      icon: Layers,
      color: 'text-purple-400',
      bg: 'bg-purple-950/30 border-purple-800/40'
    },
    {
      label: 'Assigned to Me',
      value: metrics?.assignedToMe || 0,
      icon: UserCheck,
      color: 'text-blue-400',
      bg: 'bg-blue-950/30 border-blue-800/40'
    },
    {
      label: 'Overdue Tasks',
      value: metrics?.overdueTasks || 0,
      icon: AlertTriangle,
      color: 'text-rose-400',
      bg: 'bg-rose-950/30 border-rose-800/40'
    }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-transparent border border-gray-800/80 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Workspace Dashboard
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Real-time analytics and task velocity for{' '}
            <span className="text-indigo-300 font-medium">
              {currentWorkspace?.name}
            </span>
          </p>
        </div>
      </div>

      {/* 4 Overview Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className={`p-5 rounded-2xl border ${card.bg} backdrop-blur-sm transition-all hover:scale-[1.01]`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-400">{card.label}</span>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <p className="text-2xl font-bold text-white mt-2">{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* Two Column Layout: Tasks Breakdown & Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="p-5 rounded-2xl bg-[#0e1322] border border-gray-800/80">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wider">
              Tasks by Status
            </h3>
            <span className="text-[11px] text-gray-500">
              {metrics?.totalTasks || 0} Total
            </span>
          </div>

          <div className="space-y-3">
            {[
              {
                status: 'TODO',
                label: 'To Do',
                count: metrics?.tasksByStatus?.TODO || 0,
                barColor: 'bg-slate-400'
              },
              {
                status: 'IN_PROGRESS',
                label: 'In Progress',
                count: metrics?.tasksByStatus?.IN_PROGRESS || 0,
                barColor: 'bg-indigo-500'
              },
              {
                status: 'DONE',
                label: 'Done',
                count: metrics?.tasksByStatus?.DONE || 0,
                barColor: 'bg-emerald-500'
              }
            ].map((item) => {
              const total = metrics?.totalTasks || 1;
              const percentage = Math.round((item.count / total) * 100);

              return (
                <div key={item.status} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-300 font-medium">{item.label}</span>
                    <span className="text-gray-400">{item.count} ({percentage}%)</span>
                  </div>
                  <div className="h-2 w-full bg-gray-800/80 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.barColor} transition-all duration-500`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Priority Breakdown */}
        <div className="p-5 rounded-2xl bg-[#0e1322] border border-gray-800/80">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wider">
              Tasks by Priority
            </h3>
            <span className="text-[11px] text-gray-500">Active Load</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Low', count: metrics?.tasksByPriority?.LOW || 0, color: 'text-slate-400', bg: 'bg-slate-900/40 border-slate-800' },
              { label: 'Medium', count: metrics?.tasksByPriority?.MEDIUM || 0, color: 'text-blue-400', bg: 'bg-blue-950/30 border-blue-900/40' },
              { label: 'High', count: metrics?.tasksByPriority?.HIGH || 0, color: 'text-amber-400', bg: 'bg-amber-950/30 border-amber-900/40' },
              { label: 'Urgent', count: metrics?.tasksByPriority?.URGENT || 0, color: 'text-rose-400', bg: 'bg-rose-950/30 border-rose-900/40' }
            ].map((p) => (
              <div key={p.label} className={`p-3 rounded-xl border ${p.bg}`}>
                <span className="text-[11px] font-medium text-gray-400 block">{p.label}</span>
                <span className={`text-xl font-bold ${p.color} mt-1 block`}>{p.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Two Column Layout: Recently Updated Tasks & Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recently Updated Tasks */}
        <div className="p-5 rounded-2xl bg-[#0e1322] border border-gray-800/80">
          <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wider mb-4">
            Recently Updated Tasks
          </h3>

          <div className="space-y-2.5">
            {metrics?.recentlyUpdatedTasks?.length > 0 ? (
              metrics.recentlyUpdatedTasks.map((t) => (
                <div
                  key={t._id}
                  onClick={() => setSelectedTaskId(t._id)}
                  className="p-3 rounded-xl bg-[#141926] hover:bg-[#181f30] border border-gray-800/60 flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <h4 className="text-xs font-medium text-gray-200 truncate">{t.title}</h4>
                    <p className="text-[10px] text-gray-500 mt-0.5">{t.projectId?.name || 'Project'}</p>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    <PriorityBadge priority={t.priority} />
                    <StatusBadge status={t.status} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-500 py-4 text-center">No recent tasks</p>
            )}
          </div>
        </div>

        {/* Workspace Activity Feed */}
        <div className="p-5 rounded-2xl bg-[#0e1322] border border-gray-800/80">
          <div className="flex items-center space-x-2 mb-4">
            <Activity className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wider">
              Recent Workspace Activity
            </h3>
          </div>

          <div className="space-y-3">
            {activities.length > 0 ? (
              activities.map((act) => (
                <div key={act._id} className="flex items-start space-x-3 text-xs">
                  <Avatar user={act.actorId} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-300">
                      <span className="font-semibold text-gray-100">{act.actorId?.name || 'User'}</span>{' '}
                      <span className="text-gray-400">{act.action.toLowerCase().replace('_', ' ')}</span>{' '}
                      <span className="text-indigo-400 font-medium">
                        {act.metadata?.taskTitle || act.metadata?.name || act.entityType.toLowerCase()}
                      </span>
                    </p>
                    <span className="text-[10px] text-gray-500">
                      {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-500 py-4 text-center">No recent activity recorded</p>
            )}
          </div>
        </div>
      </div>

      {/* Task Inspection Drawer Modal */}
      <TaskDetailModal
        isOpen={!!selectedTaskId}
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onTaskUpdated={loadDashboardData}
        onTaskDeleted={loadDashboardData}
      />
    </div>
  );
};
