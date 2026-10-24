import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAuth } from '../context/AuthContext';
import { workspaceService } from '../services/workspaceService';
import { InviteMemberModal } from '../components/modals/InviteMemberModal';
import { Avatar } from '../components/common/Avatar';
import { RoleBadge } from '../components/common/Badge';
import {
  Users,
  Plus,
  Trash2,
  Shield,
  Loader2,
  AlertCircle
} from 'lucide-react';

export const Members = () => {
  const { currentWorkspace, members, refreshMembers, isAdmin } = useWorkspace();
  const { user } = useAuth();

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [error, setError] = useState('');

  const handleRoleChange = async (targetUserId, newRole) => {
    if (!isAdmin) return;
    try {
      setUpdatingUserId(targetUserId);
      setError('');
      await workspaceService.updateMemberRole(currentWorkspace._id, targetUserId, newRole);
      await refreshMembers();
    } catch (err) {
      setError(err.message || 'Failed to update member role');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleRemoveMember = async (targetUserId, targetName) => {
    const isSelf = targetUserId === user?.id;
    const confirmMessage = isSelf
      ? 'Are you sure you want to leave this workspace?'
      : `Are you sure you want to remove ${targetName} from the workspace?`;

    if (!window.confirm(confirmMessage)) return;

    try {
      setUpdatingUserId(targetUserId);
      setError('');
      await workspaceService.removeMember(currentWorkspace._id, targetUserId);
      await refreshMembers();
    } catch (err) {
      setError(err.message || 'Failed to remove member');
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-800/80">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Workspace Members</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Manage collaborators and roles in <span className="text-indigo-300 font-medium">{currentWorkspace?.name}</span>
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setInviteModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Member</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-3.5 bg-rose-950/40 border border-rose-800/60 rounded-xl flex items-center space-x-2 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Members Table */}
      <div className="rounded-2xl bg-[#0e1322] border border-gray-800/80 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#141928] text-gray-400 font-semibold uppercase text-[10px] tracking-wider border-b border-gray-800/80">
              <tr>
                <th className="px-5 py-3.5">User</th>
                <th className="px-5 py-3.5">Email</th>
                <th className="px-5 py-3.5">Role</th>
                <th className="px-5 py-3.5">Joined</th>
                {isAdmin && <th className="px-5 py-3.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {members.map((m) => {
                const isOwner = currentWorkspace?.ownerId?._id === m.user.id || currentWorkspace?.ownerId === m.user.id;
                const isCurrentAuthUser = m.user.id === user?.id;

                return (
                  <tr key={m.id} className="hover:bg-gray-800/30 transition-colors">
                    {/* User Identity */}
                    <td className="px-5 py-4 flex items-center space-x-3">
                      <Avatar user={m.user} size="md" />
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-gray-200">{m.user.name}</span>
                          {isCurrentAuthUser && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-medium">
                              You
                            </span>
                          )}
                          {isOwner && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-medium">
                              Owner
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-5 py-4 text-gray-400 font-mono text-[11px]">
                      {m.user.email}
                    </td>

                    {/* Role / Role Selector */}
                    <td className="px-5 py-4">
                      {isAdmin && !isOwner ? (
                        <select
                          value={m.role}
                          onChange={(e) => handleRoleChange(m.user.id, e.target.value)}
                          disabled={updatingUserId === m.user.id}
                          className="bg-[#161c2e] border border-gray-700/80 rounded-lg px-2 py-1 text-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                        >
                          <option value="Admin">Admin</option>
                          <option value="Member">Member</option>
                          <option value="Viewer">Viewer</option>
                        </select>
                      ) : (
                        <RoleBadge role={m.role} />
                      )}
                    </td>

                    {/* Joined Date */}
                    <td className="px-5 py-4 text-gray-500 text-[11px]">
                      {new Date(m.joinedAt).toLocaleDateString()}
                    </td>

                    {/* Actions */}
                    {isAdmin && (
                      <td className="px-5 py-4 text-right">
                        {!isOwner && (
                          <button
                            onClick={() => handleRemoveMember(m.user.id, m.user.name)}
                            disabled={updatingUserId === m.user.id}
                            className="text-gray-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-950/20 transition-colors cursor-pointer"
                            title="Remove member"
                          >
                            {updatingUserId === m.user.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <InviteMemberModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        onMemberAdded={refreshMembers}
      />
    </div>
  );
};
