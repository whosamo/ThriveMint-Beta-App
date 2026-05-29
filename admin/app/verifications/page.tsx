import { adminSupabase, storageUrl } from '@/lib/supabase';
import Nav from '@/components/Nav';
import VerificationCard from './VerificationCard';

export const dynamic = 'force-dynamic';

export default async function VerificationsPage() {
  const { data: profiles } = await adminSupabase
    .from('freelancer_profiles')
    .select(`
      id,
      bio,
      service_categories,
      user_id,
      portfolio_items (id, type, media_url, title)
    `)
    .eq('verification_status', 'pending')
    .order('created_at', { ascending: true });

  const userIds = (profiles ?? []).map((p: any) => p.user_id);

  let userMap: Map<string, any> = new Map();
  if (userIds.length > 0) {
    const { data: users } = await adminSupabase
      .from('users')
      .select('id, full_name, avatar_url, city, state')
      .in('id', userIds);
    for (const u of users ?? []) userMap.set(u.id, u);
  }

  const items = (profiles ?? []).map((p: any) => {
    const u = userMap.get(p.user_id) ?? {};
    return {
      id: p.id,
      userId: p.user_id,
      fullName: u.full_name ?? 'Unknown',
      avatarUrl: storageUrl('avatars', u.avatar_url),
      bio: p.bio ?? null,
      serviceCategories: p.service_categories ?? [],
      city: u.city ?? null,
      state: u.state ?? null,
      portfolioItems: (p.portfolio_items ?? []).map((pi: any) => ({
        id: pi.id,
        type: pi.type,
        media_url: storageUrl('portfolios', pi.media_url),
        title: pi.title ?? null,
      })),
    };
  });

  return (
    <div className="flex min-h-screen">
      <Nav active="/verifications" />
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-100">Verifications</h1>
            <p className="text-gray-500 mt-1">
              {items.length} freelancer{items.length !== 1 ? 's' : ''} pending review
            </p>
          </div>

          {items.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
              <p className="text-4xl mb-3">✓</p>
              <p className="text-gray-400 font-medium">All caught up — no pending verifications.</p>
            </div>
          ) : (
            <div className="grid gap-5">
              {items.map((item) => (
                <VerificationCard key={item.id} {...item} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
