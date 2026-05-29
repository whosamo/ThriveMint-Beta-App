import { supabase } from './supabase';
import { ReportPayload } from '../types/safety';

export async function submitReport(payload: ReportPayload): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('reports').insert({
    reporter_id:      user.id,
    reported_user_id: payload.reportedUserId,
    content_type:     payload.contentType,
    content_id:       payload.contentId ?? null,
    reason:           payload.reason,
    details:          payload.details ?? null,
    status:           'pending',
  });

  if (error) throw error;
  // DB trigger handles admin_alert insertion and auto-suspend logic
}

export async function blockUser(blockedId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('blocks').insert({
    blocker_id: user.id,
    blocked_id: blockedId,
  });

  if (error && error.code !== '23505') throw error; // ignore duplicate
}

export async function getBlockedUserIds(): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('blocks')
    .select('blocked_id')
    .eq('blocker_id', user.id);

  return (data ?? []).map((r: any) => r.blocked_id as string);
}
