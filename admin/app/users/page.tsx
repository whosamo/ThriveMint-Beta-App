import { adminSupabase } from '@/lib/supabase';
import Nav from '@/components/Nav';
import UserRow from './UserRow';

export const dynamic = 'force-dynamic';

interface SearchParams {
  q?: string;
  role?: string;
  status?: string;
  city?: string;
  state?: string;
}

export default async function UsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const { q, role, status, city, state } = params;

  let query = adminSupabase
    .from('users')
    .select('id, full_name, email, role, city, state, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (role) query = query.eq('role', role);
  if (city) query = query.ilike('city', `%${city}%`);
  if (state) query = query.ilike('state', `%${state}%`);
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);

  const { data: users } = await query;

  // Fetch freelancer profiles for verification status
  const userIds = (users ?? []).map((u: any) => u.id);
  let fpMap: Map<string, any> = new Map();

  if (userIds.length > 0) {
    const { data: fps } = await adminSupabase
      .from('freelancer_profiles')
      .select('id, user_id, verification_status')
      .in('user_id', userIds);
    for (const fp of fps ?? []) fpMap.set(fp.user_id, fp);
  }

  const filteredUsers = (users ?? []).filter((u: any) => {
    if (!status) return true;
    const fp = fpMap.get(u.id);
    return fp?.verification_status === status;
  });

  const totalCount = filteredUsers.length;

  return (
    <div className="flex min-h-screen">
      <Nav active="/users" />
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-100">Users</h1>
            <p className="text-gray-500 mt-1">{totalCount} user{totalCount !== 1 ? 's' : ''}</p>
          </div>

          {/* Filters */}
          <form className="flex flex-wrap gap-3 mb-6">
            <input
              name="q"
              defaultValue={q ?? ''}
              placeholder="Search name or email…"
              className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand w-64"
            />
            <select
              name="role"
              defaultValue={role ?? ''}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-brand"
            >
              <option value="">All roles</option>
              <option value="business">Business</option>
              <option value="freelancer">Freelancer</option>
              <option value="both">Both</option>
            </select>
            <select
              name="status"
              defaultValue={status ?? ''}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-brand"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="suspended">Suspended</option>
            </select>
            <input
              name="city"
              defaultValue={city ?? ''}
              placeholder="City"
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand w-32"
            />
            <input
              name="state"
              defaultValue={state ?? ''}
              placeholder="State"
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand w-24"
            />
            <button
              type="submit"
              className="bg-brand/10 hover:bg-brand/20 text-brand border border-brand/30 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              Filter
            </button>
            <a
              href="/users"
              className="text-gray-500 hover:text-gray-300 text-sm px-3 py-2 transition-colors"
            >
              Clear
            </a>
          </form>

          {/* Table */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">User</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Role</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Location</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Joined</th>
                  <th className="text-right px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500 text-sm">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u: any) => {
                    const fp = fpMap.get(u.id);
                    return (
                      <UserRow
                        key={u.id}
                        id={u.id}
                        fullName={u.full_name}
                        email={u.email}
                        role={u.role}
                        city={u.city}
                        state={u.state}
                        createdAt={u.created_at}
                        verificationStatus={fp?.verification_status ?? null}
                        freelancerId={fp?.id ?? null}
                      />
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
