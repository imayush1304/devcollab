import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { workspaceService } from '../services/workspaceService';
import { projectService } from '../services/projectService';
import { useAuth } from './AuthContext';

const WorkspaceContext = createContext(null);

export const WorkspaceProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();

  const [workspaces, setWorkspaces] = useState([]);
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [currentRole, setCurrentRole] = useState(null);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch workspaces on user authentication
  const fetchWorkspaces = useCallback(async () => {
    if (!isAuthenticated) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setCurrentRole(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const list = await workspaceService.getWorkspaces();
      setWorkspaces(list || []);

      // If no current workspace is selected or current is no longer in list, pick first
      if (list && list.length > 0) {
        const savedId = localStorage.getItem('devcollab_active_workspace_id');
        const matched = list.find(w => w._id === savedId) || list[0];
        setCurrentWorkspace(matched);
        setCurrentRole(matched.userRole || null);
      } else {
        setCurrentWorkspace(null);
        setCurrentRole(null);
      }
    } catch (err) {
      console.error('Failed to load workspaces:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  // Load projects and members whenever current workspace changes
  const loadWorkspaceResources = useCallback(async () => {
    if (!currentWorkspace?._id) {
      setProjects([]);
      setMembers([]);
      return;
    }

    try {
      const [projList, memberList] = await Promise.all([
        projectService.getWorkspaceProjects(currentWorkspace._id),
        workspaceService.getMembers(currentWorkspace._id)
      ]);
      setProjects(projList || []);
      setMembers(memberList || []);
    } catch (err) {
      console.error('Failed to load workspace projects/members:', err);
    }
  }, [currentWorkspace?._id]);

  useEffect(() => {
    loadWorkspaceResources();
  }, [loadWorkspaceResources]);

  const switchWorkspace = (workspaceId) => {
    const found = workspaces.find(w => w._id === workspaceId);
    if (found) {
      setCurrentWorkspace(found);
      setCurrentRole(found.userRole || null);
      localStorage.setItem('devcollab_active_workspace_id', workspaceId);
    }
  };

  const createWorkspace = async (data) => {
    const created = await workspaceService.createWorkspace(data);
    await fetchWorkspaces();
    if (created?.workspace?._id) {
      switchWorkspace(created.workspace._id);
    }
    return created;
  };

  const value = {
    workspaces,
    currentWorkspace,
    currentRole,
    isAdmin: currentRole === 'Admin',
    isMember: currentRole === 'Member' || currentRole === 'Admin',
    isViewer: currentRole === 'Viewer',
    projects,
    members,
    loading,
    switchWorkspace,
    refreshWorkspaces: fetchWorkspaces,
    refreshProjects: loadWorkspaceResources,
    refreshMembers: loadWorkspaceResources,
    createWorkspace
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
