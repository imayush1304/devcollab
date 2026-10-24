import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PriorityBadge } from '../common/Badge';
import { Avatar } from '../common/Avatar';
import { Calendar, MoreVertical, GripVertical, CheckCircle2, Clock, CircleDot } from 'lucide-react';

export const TaskCard = ({ task, onClick, onStatusChange, isViewer }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: task._id,
    data: { task }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition
  };

  const isOverdue =
    task.dueDate &&
    new Date(task.dueDate) < new Date() &&
    task.status !== 'DONE';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-xl bg-[#141926] border border-gray-800/90 hover:border-gray-700/80 p-3.5 shadow-md hover:shadow-xl transition-all cursor-pointer ${
        isDragging ? 'opacity-40 scale-102 ring-2 ring-indigo-500' : ''
      }`}
      onClick={() => onClick(task)}
    >
      {/* Top Row: Drag Handle + Priority + Quick Move Menu */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          {/* Accessible Drag Handle (Hidden for Viewers) */}
          {!isViewer && (
            <button
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
              className="text-gray-600 hover:text-gray-300 transition-colors cursor-grab active:cursor-grabbing p-0.5"
              title="Drag to reorder"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </button>
          )}
          <PriorityBadge priority={task.priority} />
        </div>

        {/* Accessible Quick Status Move Dropdown */}
        {!isViewer && onStatusChange && (
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-300 p-1 rounded-md transition-all cursor-pointer"
              title="Move task"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 mt-1 w-36 rounded-xl bg-[#0f1422] border border-gray-800 shadow-xl py-1 z-30 text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-2.5 py-1 text-[10px] text-gray-500 font-semibold uppercase">Move to</div>
                {task.status !== 'TODO' && (
                  <button
                    onClick={() => {
                      onStatusChange(task._id, 'TODO');
                      setMenuOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-gray-800/60 text-gray-300 hover:text-white flex items-center space-x-1.5 cursor-pointer"
                  >
                    <CircleDot className="w-3 h-3 text-slate-400" />
                    <span>To Do</span>
                  </button>
                )}
                {task.status !== 'IN_PROGRESS' && (
                  <button
                    onClick={() => {
                      onStatusChange(task._id, 'IN_PROGRESS');
                      setMenuOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-gray-800/60 text-gray-300 hover:text-white flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Clock className="w-3 h-3 text-indigo-400" />
                    <span>In Progress</span>
                  </button>
                )}
                {task.status !== 'DONE' && (
                  <button
                    onClick={() => {
                      onStatusChange(task._id, 'DONE');
                      setMenuOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-gray-800/60 text-gray-300 hover:text-white flex items-center space-x-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Done</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Task Title */}
      <h4 className="text-xs font-medium text-gray-100 line-clamp-2 leading-relaxed mb-3">
        {task.title}
      </h4>

      {/* Bottom Row: Due Date + Assignee Avatar */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-800/50 text-[11px]">
        {task.dueDate ? (
          <div
            className={`flex items-center space-x-1 ${
              isOverdue ? 'text-rose-400 font-medium' : 'text-gray-400'
            }`}
          >
            <Calendar className="w-3 h-3 shrink-0" />
            <span>
              {new Date(task.dueDate).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric'
              })}
            </span>
          </div>
        ) : (
          <span className="text-gray-600 text-[10px]">No due date</span>
        )}

        <Avatar user={task.assigneeId} size="sm" />
      </div>
    </div>
  );
};
