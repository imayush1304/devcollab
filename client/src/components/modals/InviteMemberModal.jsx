import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useWorkspace } from '../../context/WorkspaceContext';
import { workspaceService } from '../../services/workspaceService';
import { AlertCircle, Loader2 } from 'lucide-react';

export const InviteMemberModal = ({ isOpen, onClose, onMemberAdded }) => {
  const { currentWorkspace, refreshMembers } = useWorkspace();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Email address is required');
      return;
    }

    try {
      setLoading(true);
      const newMember = await workspaceService.addMember(currentWorkspace._id, {
        email: email.trim(),
        role
      });

      setEmail('');
      setRole('Member');
      await refreshMembers();
      if (onMemberAdded) onMemberAdded(newMember);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to add member to workspace');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Member to Workspace"
      subtitle={`Add registered user to ${currentWorkspace?.name || ''}`}
      maxWidth="max-w-md"
    >
      {error && (
        <div className="mb-4 p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl flex items-center space-x-2 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block text-gray-300 font-medium mb-1">User Email *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. sarah.dev@example.com"
            required
            className="w-full bg-[#161c2e] border border-gray-700/80 rounded-xl px-3 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <p className="mt-1 text-[11px] text-gray-500">
            For the MVP, users must be registered on DevCollab before they can be added.
          </p>
        </div>

        <div>
          <label className="block text-gray-300 font-medium mb-1">Workspace Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full bg-[#161c2e] border border-gray-700/80 rounded-xl px-3 py-2 text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="Member">Member (Create and update tasks)</option>
            <option value="Admin">Admin (Full workspace control)</option>
            <option value="Viewer">Viewer (Read-only access)</option>
          </select>
        </div>

        <div className="pt-3 flex items-center justify-end space-x-2 border-t border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-xl text-xs text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition-all disabled:opacity-50 cursor-pointer flex items-center space-x-1.5"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Add Member</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
