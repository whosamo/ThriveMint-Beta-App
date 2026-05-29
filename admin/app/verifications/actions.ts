'use server';

import { revalidatePath } from 'next/cache';
import { adminSupabase } from '@/lib/supabase';

export async function approveFreelancer(freelancerProfileId: string, userId: string) {
  const { error } = await adminSupabase
    .from('freelancer_profiles')
    .update({ verification_status: 'approved', rejection_reason: null })
    .eq('id', freelancerProfileId);

  if (error) throw error;

  await adminSupabase.from('notifications').insert({
    user_id: userId,
    type: 'system',
    title: '🎉 Profile Approved',
    body: 'Your ThriveMint profile has been verified. You can now appear in business searches.',
  });

  revalidatePath('/verifications');
}

export async function rejectFreelancer(
  freelancerProfileId: string,
  userId: string,
  reason: string,
) {
  const { error } = await adminSupabase
    .from('freelancer_profiles')
    .update({ verification_status: 'rejected', rejection_reason: reason })
    .eq('id', freelancerProfileId);

  if (error) throw error;

  await adminSupabase.from('notifications').insert({
    user_id: userId,
    type: 'system',
    title: 'Profile Not Approved',
    body: `Your profile was not approved. Reason: ${reason}. Please update your profile and resubmit.`,
  });

  revalidatePath('/verifications');
}
