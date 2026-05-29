import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { FeedItem } from '../types/feed';
import { getTodayStatusForUsers } from './availabilityService';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function cacheKey(userId: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `feed_rank_cache_${userId}_${date}`;
}

function applyRankedOrder(items: FeedItem[], rankedIds: string[]): FeedItem[] {
  const pos = new Map(rankedIds.map((id, i) => [id, i]));
  return [...items].sort((a, b) => {
    const ia = pos.get(a.freelancer_id) ?? Infinity;
    const ib = pos.get(b.freelancer_id) ?? Infinity;
    return ia - ib;
  });
}

export interface RankOptions {
  briefContext?: { service_category: string; ideal_freelancer_profile: string; brief_title: string };
}

async function enrichWithAvailability(items: FeedItem[]): Promise<FeedItem[]> {
  if (items.length === 0) return items;

  const userIds = items.map(i => i.user_id);
  const freelancerIds = items.map(i => i.freelancer_id);

  const [todayMap, profilesRes] = await Promise.all([
    getTodayStatusForUsers(userIds),
    supabase
      .from('freelancer_profiles')
      .select('id, accepting_new_work, typical_response_time')
      .in('id', freelancerIds),
  ]);

  // freelancer_id → profile settings
  const profileMap = new Map<string, { accepting_new_work: boolean; typical_response_time: string }>();
  for (const row of (profilesRes.data ?? []) as any[]) {
    profileMap.set(row.id, { accepting_new_work: row.accepting_new_work, typical_response_time: row.typical_response_time });
  }

  return items.map(item => ({
    ...item,
    accepting_new_work: profileMap.get(item.freelancer_id)?.accepting_new_work ?? true,
    typical_response_time: profileMap.get(item.freelancer_id)?.typical_response_time ?? 'within_48_hours',
    is_available_today: todayMap.get(item.user_id) === 'available',
  }));
}

export async function rankFeedItems(items: FeedItem[], options?: RankOptions): Promise<FeedItem[]> {
  if (items.length === 0) return items;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return items;

  const key = cacheKey(user.id);
  const hasBrief = !!options?.briefContext;

  let enrichedItems: FeedItem[];
  try {
    enrichedItems = await enrichWithAvailability(items);
  } catch {
    enrichedItems = items;
  }

  if (!hasBrief) {
    try {
      const cached = await AsyncStorage.getItem(key);
      if (cached) {
        const { rankedIds, timestamp } = JSON.parse(cached) as { rankedIds: string[]; timestamp: number };
        if (Date.now() - timestamp < CACHE_TTL_MS) {
          return applyRankedOrder(enrichedItems, rankedIds);
        }
      }
    } catch {
      // proceed without cache
    }
  }

  try {
    const { data, error } = await supabase.functions.invoke('rank-feed', {
      body: { items: enrichedItems, userId: user.id, briefContext: options?.briefContext ?? null },
    });

    if (error || !data?.rankedIds) return enrichedItems;

    if (!hasBrief) {
      await AsyncStorage.setItem(key, JSON.stringify({ rankedIds: data.rankedIds, timestamp: Date.now() }));
    }
    return applyRankedOrder(enrichedItems, data.rankedIds);
  } catch {
    return enrichedItems;
  }
}
