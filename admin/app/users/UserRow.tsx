'use client';

import { useState } from 'react';
import { suspendUser, unsuspendUser, deleteUser } from './actions';

interface Props {
  id: string;
  fullName: string;
  email: string;
  role: string;
  city: string | null;
  state: string | null;
  createdAt: string;
  verificationStatus: string | null;
  freelancerId: string | null;
}

export default function UserRow({
  id, fullName, email, role, city, state, createdAt, verificationStatus, freelancerId,
}: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState(verificationStatus);
  const [deleted, setDeleted] = useState(false);

  if (deleted) {
    return (
      <tr className="opacity-40">
        <td colSpan={7} className="px-4 py-3 text-sm text-gray-500 italic">Deleted — {fullName}</td>
      </tr>
    );
  }

  const isSuspended = currentStatus === 'suspended';

  async function handleSuspend() {
    setLoading('suspend');
    if (isSuspended) {
      await unsuspendUser(id);
      setCurrentStatus('pending');
    } else {
      await suspendUser(id);
      setCurrentStatus('suspended');
    }
    setLoading(null);
  }

  async function handleDelete() {
    if (!confirm(`Permanently delete ${fullName}? This cannot be undone.`)) return;
    setLoading('delete');
    try {
      await deleteUser(id);
      setDeleted(true);
    } catch {
      alert('Failed to delete user. They may have active projects.');
    }
    setLoading(null);
  }

  const roleColors: Record<string, string> = {
    business: 'text-blue-400 bg-blue-500/10 border-blue-800',
    freelancer: 'text-brand bg-brand/10 border-brand/20',
    both: 'text-purple-400 bg-purple-500/10 border-purple-800',
  };

  const statusColors: Record<string, string> = {
    approved: 'text-brand',
    pending: 'text-yellow-400',
    rejected: 'text-red-400',
    suspended: 'text-red-500',
  };

  return (
    <tr className={`border-b border-gray-800 hover:bg-gray-800/40 transition-colors ${isSuspended ? 'opacity-60' : ''}`}>
      <td className="px-4 py-3">
        <div className="font-medium text-gray-100 text-sm">{fullName}</div>
        <div className="text-gray-500 text-xs">{email}</div>
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${roleColors[role] ?? 'text-gray-400 border-gray-700'}`}>
          {role}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-400">
        {[city, state].filter(Boolean).join(', ') || '—'}
      </td>
      <td className="px-4 py-3 text-sm">
        {currentStatus ? (
          <span className={`text-xs font-medium ${statusColors[currentStatus] ?? 'text-gray-400'}`}>
            {currentStatus}
          </span>
        ) : (
          <span className="text-gray-600 text-xs">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">
        {new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          {freelancerId && (
            <a
              href={`/verifications`}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Profile
            </a>
          )}
          <button
            onClick={handleSuspend}
            disabled={!!loading}
            className={`text-xs font-medium px-2.5 py-1 rounded transition-colors disabled:opacity-50 ${
              isSuspended
                ? 'text-brand hover:bg-brand/10'
                : 'text-yellow-400 hover:bg-yellow-500/10'
            }`}
          >
            {loading === 'suspend' ? '…' : isSuspended ? 'Unsuspend' : 'Suspend'}
          </button>
          <button
            onClick={handleDelete}
            disabled={!!loading}
            className="text-xs font-medium px-2.5 py-1 rounded text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            {loading === 'delete' ? '…' : 'Delete'}
          </button>
        </div>
      </td>
    </tr>
  );
}
