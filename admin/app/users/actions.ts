'use server';

import { revalidatePath } from 'next/cache';
import { adminSupabase } from '@/lib/supabase';

export async function suspendUser(userId: string) {
  // Suspend by setting verification_status on their profile(s)
  await adminSupabase
    .from('freelancer_profiles')
    .update({ verification_status: 'suspended' })
    .eq('user_id', userId);

  await adminSupabase.from('notifications').insert({
    user_id: userId,
    type: 'system',
    title: 'Account Suspended',
    body: 'Your ThriveMint account has been suspended. Contact support@thrivemint.com if you believe this is an error.',
  });

  revalidatePath('/users');
}

export async function unsuspendUser(userId: string) {
  await adminSupabase
    .from('freelancer_profiles')
    .update({ verification_status: 'pending' })
    .eq('user_id', userId)
    .eq('verification_status', 'suspended');

  revalidatePath('/users');
}

export async function deleteUser(userId: string) {
  // Delete via Supabase Auth admin API — cascades to all profile tables via FK
  const { error } = await adminSupabase.auth.admin.deleteUser(userId);
  if (error) throw error;
  revalidatePath('/users');
}
