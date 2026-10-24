import React from 'react';

export const Avatar = ({ user, size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm'
  };

  const name = user?.name || 'User';
  const initial = name.charAt(0).toUpperCase();

  // Deterministic subtle gradient based on name hash
  const colors = [
    'from-indigo-600 to-indigo-800 text-indigo-100 border-indigo-500/40',
    'from-purple-600 to-purple-800 text-purple-100 border-purple-500/40',
    'from-pink-600 to-pink-800 text-pink-100 border-pink-500/40',
    'from-teal-600 to-teal-800 text-teal-100 border-teal-500/40',
    'from-blue-600 to-blue-800 text-blue-100 border-blue-500/40'
  ];

  const charCode = name.charCodeAt(0) || 0;
  const colorClass = colors[charCode % colors.length];

  if (user?.avatarUrl && !user.avatarUrl.includes('placeholder')) {
    return (
      <img
        src={user.avatarUrl}
        alt={name}
        className={`${sizeClasses[size] || sizeClasses.md} rounded-full object-cover border border-gray-700/60 ${className}`}
      />
    );
  }

  return (
    <div
      title={name}
      className={`${sizeClasses[size] || sizeClasses.md} rounded-full bg-gradient-to-tr ${colorClass} font-semibold flex items-center justify-center border shadow-sm shrink-0 select-none ${className}`}
    >
      {initial}
    </div>
  );
};
