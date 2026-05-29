import { adminSupabase } from '@/lib/supabase';
import Nav from '@/components/Nav';

export const dynamic = 'force-dynamic';

export default async function WaitlistPage() {
  const { data: entries } = await adminSupabase
    .from('waitlist_emails')
    .select('id, email, name, role, city, created_at')
    .order('created_at', { ascending: false });

  const list = entries ?? [];

  const roleCounts = list.reduce<Record<string, number>>((acc, e: any) => {
    const r = e.role ?? 'unknown';
    acc[r] = (acc[r] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex min-h-screen">
      <Nav active="/waitlist" />
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-100">Waitlist</h1>
              <p className="text-gray-500 mt-1">{list.length} sign-up{list.length !== 1 ? 's' : ''}</p>
            </div>
            <a
              href="/api/waitlist/export"
              download
              className="flex items-center gap-2 bg-brand/10 hover:bg-brand/20 text-brand border border-brand/30 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              ↓ Export CSV
            </a>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total', value: list.length },
              { label: 'Freelancers', value: roleCounts.freelancer ?? 0 },
              { label: 'Businesses', value: roleCounts.business ?? 0 },
              { label: 'Both', value: roleCounts.both ?? 0 },
            ].map((stat) => (
              <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-2xl font-bold text-brand">{stat.value}</p>
                <p className="text-sm text-gray-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Table */}
          {list.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
              <p className="text-gray-400">No waitlist entries yet.</p>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">#</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Email</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Name</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Role</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">City</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Signed Up</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((entry: any, i: number) => (
                    <tr key={entry.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-600">{list.length - i}</td>
                      <td className="px-4 py-3 text-sm text-gray-200 font-medium">{entry.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-400">{entry.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        {entry.role ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                            entry.role === 'freelancer'
                              ? 'text-brand border-brand/20 bg-brand/10'
                              : entry.role === 'business'
                              ? 'text-blue-400 border-blue-800 bg-blue-500/10'
                              : 'text-purple-400 border-purple-800 bg-purple-500/10'
                          }`}>
                            {entry.role}
                          </span>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{entry.city ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(entry.created_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
