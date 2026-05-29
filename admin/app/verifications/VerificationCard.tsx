'use client';

import { useState } from 'react';
import Image from 'next/image';
import { approveFreelancer, rejectFreelancer } from './actions';

const REJECT_REASONS = [
  'Insufficient portfolio',
  'Fake or misleading profile',
  'Incomplete profile information',
  'Low quality work samples',
  'Does not meet service standards',
  'Other',
];

interface PortfolioItem {
  id: string;
  type: string;
  media_url: string | null;
  title: string | null;
}

interface Props {
  id: string;
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  bio: string | null;
  serviceCategories: string[];
  city: string | null;
  state: string | null;
  portfolioItems: PortfolioItem[];
}

export default function VerificationCard({
  id,
  userId,
  fullName,
  avatarUrl,
  bio,
  serviceCategories,
  city,
  state,
  portfolioItems,
}: Props) {
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);
  const [showRejectMenu, setShowRejectMenu] = useState(false);
  const [rejectReason, setRejectReason] = useState(REJECT_REASONS[0]);
  const [done, setDone] = useState<'approved' | 'rejected' | null>(null);

  async function handleApprove() {
    setLoading('approve');
    await approveFreelancer(id, userId);
    setDone('approved');
    setLoading(null);
  }

  async function handleReject() {
    setLoading('reject');
    await rejectFreelancer(id, userId, rejectReason);
    setDone('rejected');
    setLoading(null);
    setShowRejectMenu(false);
  }

  if (done) {
    return (
      <div className={`rounded-xl border p-5 text-sm font-medium ${
        done === 'approved'
          ? 'bg-green-950 border-green-800 text-green-400'
          : 'bg-red-950 border-red-900 text-red-400'
      }`}>
        {done === 'approved' ? '✓ Approved' : '✗ Rejected'} — {fullName}
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={fullName}
            width={56}
            height={56}
            className="rounded-full border-2 border-brand object-cover"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-green-900 flex items-center justify-center text-brand font-bold text-xl shrink-0">
            {fullName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-100 text-lg">{fullName}</h3>
          {(city || state) && (
            <p className="text-gray-500 text-sm">{[city, state].filter(Boolean).join(', ')}</p>
          )}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {serviceCategories.map((cat) => (
              <span key={cat} className="text-xs bg-brand/10 text-brand border border-brand/20 rounded-full px-2 py-0.5">
                {cat}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Bio */}
      {bio && (
        <p className="text-gray-400 text-sm leading-relaxed border-l-2 border-gray-700 pl-3">
          {bio}
        </p>
      )}

      {/* Portfolio preview */}
      {portfolioItems.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">
            Portfolio ({portfolioItems.length} items)
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {portfolioItems.slice(0, 6).map((item) => (
              <div key={item.id} className="shrink-0">
                {item.media_url ? (
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-800 relative">
                    {item.type === 'video' ? (
                      <div className="w-full h-full flex items-center justify-center text-2xl">🎬</div>
                    ) : (
                      <Image
                        src={item.media_url}
                        alt={item.title ?? 'Portfolio item'}
                        width={80}
                        height={80}
                        className="object-cover w-full h-full"
                      />
                    )}
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-gray-800 flex items-center justify-center text-gray-600 text-xs text-center px-1">
                    {item.type}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={handleApprove}
          disabled={!!loading}
          className="flex-1 bg-brand hover:bg-brand-dark text-black font-semibold py-2 rounded-lg transition-colors disabled:opacity-50 text-sm"
        >
          {loading === 'approve' ? 'Approving…' : '✓ Approve'}
        </button>

        {!showRejectMenu ? (
          <button
            onClick={() => setShowRejectMenu(true)}
            disabled={!!loading}
            className="flex-1 bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-800 font-semibold py-2 rounded-lg transition-colors disabled:opacity-50 text-sm"
          >
            ✗ Reject
          </button>
        ) : (
          <div className="flex-1 space-y-2">
            <select
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-red-500"
            >
              {REJECT_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleReject}
                disabled={!!loading}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {loading === 'reject' ? 'Rejecting…' : 'Confirm Reject'}
              </button>
              <button
                onClick={() => setShowRejectMenu(false)}
                className="px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-300 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
