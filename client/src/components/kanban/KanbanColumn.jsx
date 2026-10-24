import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskCard } from './TaskCard';
import { Plus, CircleDot, Clock, CheckCircle2 } from 'lucide-react';

export const KanbanColumn = ({
  id,
  title,
  tasks = [],
  onTaskClick,
  onAddTask,
  onStatusChange,
  isViewer
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id
  });

  const columnThemes = {
    TODO: {
      accent: 'bg-slate-400',
      icon: <CircleDot className="w-3.5 h-3.5 text-slate-400" />
    },
    IN_PROGRESS: {
      accent: 'bg-indigo-400',
      icon: <Clock className="w-3.5 h-3.5 text-indigo-400" />
    },
    DONE: {
      accent: 'bg-emerald-400',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
    }
  };

  const theme = columnThemes[id] || columnThemes.TODO;

  return (
    <div className="flex flex-col w-[85vw] max-w-[320px] sm:w-80 shrink-0 snap-center bg-[#0c101b] border border-gray-800/80 rounded-2xl h-[calc(100vh-16rem)] sm:h-[calc(100vh-14rem)] overflow-hidden shadow-lg">
      {/* Column Header */}
      <div className="px-4 py-3 border-b border-gray-800/70 flex items-center justify-between bg-[#0e1322]">
        <div className="flex items-center space-x-2">
          {theme.icon}
          <h3 className="text-xs font-semibold text-gray-200">{title}</h3>
          <span className="px-2 py-0.5 rounded-full bg-gray-800 text-[11px] font-semibold text-gray-400">
            {tasks.length}
          </span>
        </div>

        {/* Quick Add Button in Column */}
        {!isViewer && onAddTask && (
          <button
            onClick={() => onAddTask(id)}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
            title={`Add task to ${title}`}
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Droppable Task List Container */}
      <div
        ref={setNodeRef}
        className={`flex-1 p-3 overflow-y-auto space-y-3 transition-colors ${
          isOver ? 'bg-indigo-950/15 ring-1 ring-indigo-500/50' : ''
        }`}
      >
        <SortableContext
          items={tasks.map((t) => t._id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task._id}
              task={task}
              onClick={onTaskClick}
              onStatusChange={onStatusChange}
              isViewer={isViewer}
            />
          ))}
        </SortableContext>

        {/* Empty State in Column */}
        {tasks.length === 0 && (
          <div className="h-32 border-2 border-dashed border-gray-800/60 rounded-xl flex flex-col items-center justify-center text-center p-4">
            <p className="text-[11px] text-gray-500 font-medium">No tasks in {title}</p>
            {!isViewer && onAddTask && (
              <button
                onClick={() => onAddTask(id)}
                className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
              >
                + Add one now
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
