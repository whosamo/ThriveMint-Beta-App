import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/verifications', label: 'Verifications', icon: '✓' },
  { href: '/disputes', label: 'Disputes', icon: '⚠' },
  { href: '/users', label: 'Users', icon: '👥' },
  { href: '/waitlist', label: 'Waitlist', icon: '📋' },
];

async function logout() {
  'use server';
  const cookieStore = await cookies();
  cookieStore.delete('admin_session');
  redirect('/login');
}

export default function Nav({ active }: { active: string }) {
  return (
    <aside className="w-56 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-800">
        <span className="text-brand font-bold text-lg tracking-tight">ThriveMint</span>
        <span className="ml-2 text-xs text-gray-500 font-medium uppercase tracking-widest">Admin</span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand/10 text-brand'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-gray-800">
        <form action={logout}>
          <button
            type="submit"
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:text-gray-100 hover:bg-gray-800 transition-colors"
          >
            ↩ Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
