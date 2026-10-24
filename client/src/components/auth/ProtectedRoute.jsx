import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';

export const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0b0f19] text-gray-200">
        <div className="flex items-center space-x-3 bg-gray-900/80 border border-gray-800 px-6 py-4 rounded-xl shadow-2xl backdrop-blur-md">
          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
          <span className="text-sm font-medium tracking-wide">Authenticating session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};
