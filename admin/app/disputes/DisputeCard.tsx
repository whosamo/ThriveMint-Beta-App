'use client';

import { useState } from 'react';
import { saveAdminNotes, resolveDispute } from './actions';

interface Message {
  id: string;
  sender_id: string;
  content: string | null;
  message_type: string;
  created_at: string;
}

interface Milestone {
  id: string;
  title: string;
  amount: number;
  status: string;
}

interface Props {
  id: string;
  title: string;
  totalAmount: number;
  businessUserId: string;
  businessName: string;
  businessEmail: string;
  freelancerUserId: string;
  freelancerName: string;
  freelancerEmail: string;
  conversationId: string | null;
  adminNotes: string | null;
  milestones: Milestone[];
  messages: Message[];
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function DisputeCard({
  id, title, totalAmount,
  businessUserId, businessName, businessEmail,
  freelancerUserId, freelancerName, freelancerEmail,
  conversationId, adminNotes, milestones, messages,
}: Props) {
  const [notes, setNotes] = useState(adminNotes ?? '');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);
  const [showMessages, setShowMessages] = useState(false);

  async function handleSaveNotes() {
    setNotesSaving(true);
    await saveAdminNotes(id, notes);
    setNotesSaving(false);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  }

  async function handleResolve(resolution: 'release_to_freelancer' | 'refund_to_business' | 'split') {
    setResolving(resolution);
    await resolveDispute(id, resolution, businessUserId, freelancerUserId, conversationId);
    setResolved(true);
    setResolving(null);
  }

  if (resolved) {
    return (
      <div className="bg-green-950 border border-green-800 rounded-xl p-5 text-green-400 text-sm font-medium">
        ✓ Dispute resolved — {title}
      </div>
    );
  }

  const releasedAmount = milestones.filter(m => m.status === 'released').reduce((s, m) => s + m.amount, 0);
  const pendingAmount = milestones.filter(m => m.status === 'pending').reduce((s, m) => s + m.amount, 0);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-gray-100 text-lg">{title}</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Total: <span className="text-gray-300">${totalAmount.toLocaleString()}</span>
              {' · '}Released: <span className="text-brand">${releasedAmount.toLocaleString()}</span>
              {' · '}Pending: <span className="text-yellow-400">${pendingAmount.toLocaleString()}</span>
            </p>
          </div>
          <span className="text-xs bg-red-500/10 text-red-400 border border-red-800 rounded-full px-2.5 py-1 font-medium shrink-0">
            Disputed
          </span>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Parties */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1 font-medium">Business</p>
            <p className="text-gray-100 font-medium">{businessName}</p>
            <p className="text-gray-500 text-sm">{businessEmail}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1 font-medium">Freelancer</p>
            <p className="text-gray-100 font-medium">{freelancerName}</p>
            <p className="text-gray-500 text-sm">{freelancerEmail}</p>
          </div>
        </div>

        {/* Milestones */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">Milestones</p>
          <div className="space-y-1.5">
            {milestones.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{m.title}</span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-400">${m.amount.toLocaleString()}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    m.status === 'released'
                      ? 'text-brand border-brand/30 bg-brand/10'
                      : 'text-yellow-400 border-yellow-700 bg-yellow-500/10'
                  }`}>
                    {m.status === 'released' ? 'Released' : 'Pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Message thread toggle */}
        {messages.length > 0 && (
          <div>
            <button
              onClick={() => setShowMessages(!showMessages)}
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-1.5"
            >
              <span>{showMessages ? '▾' : '▸'}</span>
              {showMessages ? 'Hide' : 'View'} message thread ({messages.length} messages)
            </button>

            {showMessages && (
              <div className="mt-3 bg-gray-950 rounded-lg border border-gray-800 max-h-72 overflow-y-auto p-4 space-y-3">
                {messages.map((msg) => {
                  const isSystem = msg.message_type === 'system';
                  const isBusiness = msg.sender_id === businessUserId;
                  return (
                    <div
                      key={msg.id}
                      className={`text-sm ${
                        isSystem
                          ? 'text-center text-gray-500 italic'
                          : isBusiness
                          ? 'text-right'
                          : 'text-left'
                      }`}
                    >
                      {!isSystem && (
                        <span className="text-xs text-gray-600 block mb-0.5">
                          {isBusiness ? businessName : freelancerName} · {formatTime(msg.created_at)}
                        </span>
                      )}
                      <span
                        className={`inline-block px-3 py-1.5 rounded-lg max-w-xs ${
                          isSystem
                            ? 'text-gray-500'
                            : isBusiness
                            ? 'bg-brand/10 text-gray-200'
                            : 'bg-gray-800 text-gray-200'
                        }`}
                      >
                        {msg.content}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Admin notes */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">Internal Notes</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Add internal notes about this dispute…"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-brand resize-none"
          />
          <button
            onClick={handleSaveNotes}
            disabled={notesSaving}
            className="mt-1.5 text-xs text-gray-500 hover:text-brand transition-colors disabled:opacity-50"
          >
            {notesSaved ? '✓ Saved' : notesSaving ? 'Saving…' : 'Save notes'}
          </button>
        </div>

        {/* Resolution */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 font-medium">Resolution</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleResolve('release_to_freelancer')}
              disabled={!!resolving}
              className="bg-brand/10 hover:bg-brand/20 text-brand border border-brand/30 rounded-lg p-3 text-xs font-semibold text-center transition-colors disabled:opacity-50"
            >
              {resolving === 'release_to_freelancer' ? '…' : '→ Freelancer'}
              <div className="text-brand/60 font-normal mt-0.5">Release funds</div>
            </button>
            <button
              onClick={() => handleResolve('refund_to_business')}
              disabled={!!resolving}
              className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-800 rounded-lg p-3 text-xs font-semibold text-center transition-colors disabled:opacity-50"
            >
              {resolving === 'refund_to_business' ? '…' : '↩ Business'}
              <div className="text-blue-400/60 font-normal mt-0.5">Refund client</div>
            </button>
            <button
              onClick={() => handleResolve('split')}
              disabled={!!resolving}
              className="bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-800 rounded-lg p-3 text-xs font-semibold text-center transition-colors disabled:opacity-50"
            >
              {resolving === 'split' ? '…' : '⚖ Split'}
              <div className="text-yellow-400/60 font-normal mt-0.5">50 / 50</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
