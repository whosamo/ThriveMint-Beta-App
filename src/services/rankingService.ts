import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { FeedItem } from '../types/feed';

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

export async function rankFeedItems(items: FeedItem[], options?: RankOptions): Promise<FeedItem[]> {
  if (items.length === 0) return items;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return items;

  const key = cacheKey(user.id);
  const hasBrief = !!options?.briefContext;

  if (!hasBrief) {
    try {
      const cached = await AsyncStorage.getItem(key);
      if (cached) {
        const { rankedIds, timestamp } = JSON.parse(cached) as { rankedIds: string[]; timestamp: number };
        if (Date.now() - timestamp < CACHE_TTL_MS) {
          return applyRankedOrder(items, rankedIds);
        }
      }
    } catch {
      // proceed without cache
    }
  }

  try {
    const { data, error } = await supabase.functions.invoke('rank-feed', {
      body: { items, userId: user.id, briefContext: options?.briefContext ?? null },
    });

    if (error || !data?.rankedIds) return items;

    if (!hasBrief) {
      await AsyncStorage.setItem(key, JSON.stringify({ rankedIds: data.rankedIds, timestamp: Date.now() }));
    }
    return applyRankedOrder(items, data.rankedIds);
  } catch {
    return items;
  }
}
