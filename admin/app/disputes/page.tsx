import { adminSupabase } from '@/lib/supabase';
import Nav from '@/components/Nav';
import DisputeCard from './DisputeCard';

export const dynamic = 'force-dynamic';

export default async function DisputesPage() {
  const { data: projects } = await adminSupabase
    .from('projects')
    .select(`
      id, title, total_amount, admin_notes, conversation_id,
      business_user_id, freelancer_user_id,
      milestones (id, title, amount, status)
    `)
    .eq('status', 'disputed')
    .order('updated_at', { ascending: false });

  if (!projects || projects.length === 0) {
    return (
      <div className="flex min-h-screen">
        <Nav active="/disputes" />
        <main className="flex-1 p-8">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-100 mb-8">Disputes</h1>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
              <p className="text-4xl mb-3">✓</p>
              <p className="text-gray-400 font-medium">No active disputes.</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Fetch all users involved
  const allUserIds = [
    ...new Set(projects.flatMap((p: any) => [p.business_user_id, p.freelancer_user_id])),
  ];
  const { data: users } = await adminSupabase
    .from('users')
    .select('id, full_name, email')
    .in('id', allUserIds);

  const userMap = new Map((users ?? []).map((u: any) => [u.id, u]));

  // Fetch messages for all conversations
  const convIds = projects.map((p: any) => p.conversation_id).filter(Boolean);
  let msgMap: Map<string, any[]> = new Map();

  if (convIds.length > 0) {
    const { data: messages } = await adminSupabase
      .from('messages')
      .select('id, conversation_id, sender_id, content, message_type, created_at')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: true });

    for (const msg of messages ?? []) {
      const arr = msgMap.get(msg.conversation_id) ?? [];
      arr.push(msg);
      msgMap.set(msg.conversation_id, arr);
    }
  }

  return (
    <div className="flex min-h-screen">
      <Nav active="/disputes" />
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-100">Disputes</h1>
            <p className="text-gray-500 mt-1">
              {projects.length} active dispute{projects.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="space-y-5">
            {projects.map((p: any) => {
              const biz = userMap.get(p.business_user_id) ?? {};
              const fl = userMap.get(p.freelancer_user_id) ?? {};
              const msgs = p.conversation_id ? (msgMap.get(p.conversation_id) ?? []) : [];

              return (
                <DisputeCard
                  key={p.id}
                  id={p.id}
                  title={p.title}
                  totalAmount={p.total_amount ?? 0}
                  businessUserId={p.business_user_id}
                  businessName={biz.full_name ?? 'Unknown'}
                  businessEmail={biz.email ?? ''}
                  freelancerUserId={p.freelancer_user_id}
                  freelancerName={fl.full_name ?? 'Unknown'}
                  freelancerEmail={fl.email ?? ''}
                  conversationId={p.conversation_id ?? null}
                  adminNotes={p.admin_notes ?? null}
                  milestones={p.milestones ?? []}
                  messages={msgs}
                />
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
