import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminSupabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  // Verify session
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session')?.value;
  if (!session || session !== process.env.ADMIN_SESSION_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await adminSupabase
    .from('waitlist_emails')
    .select('email, name, role, city, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const header = 'Email,Name,Role,City,Signed Up\n';
  const rows = (data ?? [])
    .map((r: any) => {
      const escape = (v: string | null) => v ? `"${String(v).replace(/"/g, '""')}"` : '';
      return [
        escape(r.email),
        escape(r.name),
        escape(r.role),
        escape(r.city),
        escape(r.created_at ? new Date(r.created_at).toISOString() : null),
      ].join(',');
    })
    .join('\n');

  const csv = header + rows;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="thrivemint-waitlist-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
}
