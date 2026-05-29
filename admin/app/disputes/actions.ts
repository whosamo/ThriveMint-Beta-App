'use server';

import { revalidatePath } from 'next/cache';
import { adminSupabase } from '@/lib/supabase';

export async function saveAdminNotes(projectId: string, notes: string) {
  const { error } = await adminSupabase
    .from('projects')
    .update({ admin_notes: notes })
    .eq('id', projectId);
  if (error) throw error;
  revalidatePath('/disputes');
}

export async function resolveDispute(
  projectId: string,
  resolution: 'release_to_freelancer' | 'refund_to_business' | 'split',
  businessUserId: string,
  freelancerUserId: string,
  conversationId: string | null,
) {
  let systemMsg = '';

  if (resolution === 'release_to_freelancer') {
    // Mark all pending milestones as released, complete the project
    await adminSupabase
      .from('milestones')
      .update({ status: 'released' })
      .eq('project_id', projectId)
      .eq('status', 'pending');

    await adminSupabase
      .from('projects')
      .update({ status: 'completed', admin_notes: null })
      .eq('id', projectId);

    systemMsg = '✅ Dispute resolved: funds have been released to the freelancer.';

    // Notify freelancer
    await adminSupabase.from('notifications').insert({
      user_id: freelancerUserId,
      type: 'milestone',
      title: 'Dispute resolved in your favour',
      body: 'ThriveMint support has reviewed the dispute and released all outstanding payments to you.',
    });

    // Notify business
    await adminSupabase.from('notifications').insert({
      user_id: businessUserId,
      type: 'system',
      title: 'Dispute resolved',
      body: 'ThriveMint support has reviewed the dispute and released funds to the freelancer.',
    });
  } else if (resolution === 'refund_to_business') {
    await adminSupabase
      .from('projects')
      .update({ status: 'completed' })
      .eq('id', projectId);

    systemMsg = '↩ Dispute resolved: a refund has been issued to the business.';

    await adminSupabase.from('notifications').insert({
      user_id: businessUserId,
      type: 'system',
      title: 'Dispute resolved — refund issued',
      body: 'ThriveMint support has reviewed the dispute and issued a refund to your account.',
    });

    await adminSupabase.from('notifications').insert({
      user_id: freelancerUserId,
      type: 'system',
      title: 'Dispute resolved',
      body: 'ThriveMint support has reviewed the dispute. The project has been closed.',
    });
  } else {
    // Split — for now just complete the project and let admin handle Stripe manually
    await adminSupabase
      .from('projects')
      .update({ status: 'completed' })
      .eq('id', projectId);

    systemMsg = '⚖️ Dispute resolved: payment has been split. Check your account for details.';

    for (const uid of [businessUserId, freelancerUserId]) {
      await adminSupabase.from('notifications').insert({
        user_id: uid,
        type: 'system',
        title: 'Dispute resolved — split payment',
        body: 'ThriveMint support has resolved the dispute with a split payment arrangement.',
      });
    }
  }

  // System message in conversation
  if (conversationId && systemMsg) {
    const { data: { user } } = await adminSupabase.auth.admin.getUserById(businessUserId);
    await adminSupabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: businessUserId,
      message_type: 'system',
      content: systemMsg,
    });
  }

  revalidatePath('/disputes');
}
