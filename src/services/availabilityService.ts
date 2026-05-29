import { supabase } from './supabase';
import { AvailabilityEntry, AvailabilityStatus } from '../types/availability';

export async function getAvailabilityRange(
  freelancerUserId: string,
  startDate: string,
  endDate: string,
): Promise<Record<string, AvailabilityStatus>> {
  const { data } = await supabase
    .from('availability')
    .select('date, status')
    .eq('freelancer_user_id', freelancerUserId)
    .gte('date', startDate)
    .lte('date', endDate);

  const map: Record<string, AvailabilityStatus> = {};
  for (const row of data ?? []) map[row.date] = row.status;
  return map;
}

export async function getTodayStatusForUsers(
  userIds: string[],
): Promise<Map<string, AvailabilityStatus>> {
  if (userIds.length === 0) return new Map();
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('availability')
    .select('freelancer_user_id, status')
    .in('freelancer_user_id', userIds)
    .eq('date', today);

  return new Map((data ?? []).map((r) => [r.freelancer_user_id, r.status]));
}

export async function replaceMonthAvailability(
  freelancerUserId: string,
  year: number,
  month: number,
  entries: AvailabilityEntry[],
): Promise<void> {
  const pad = (n: number) => String(n).padStart(2, '0');
  const startDate = `${year}-${pad(month + 1)}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endDate = `${year}-${pad(month + 1)}-${pad(lastDay)}`;

  const { error: delErr } = await supabase
    .from('availability')
    .delete()
    .eq('freelancer_user_id', freelancerUserId)
    .gte('date', startDate)
    .lte('date', endDate);

  if (delErr) throw delErr;

  if (entries.length > 0) {
    const { error: insErr } = await supabase.from('availability').insert(entries);
    if (insErr) throw insErr;
  }
}
