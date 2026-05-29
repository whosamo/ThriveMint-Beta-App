import { supabase } from './supabase';
import { FeedItem } from '../types/feed';

export const FEED_PAGE_SIZE = 10;

export async function fetchFeedPage(offset: number): Promise<FeedItem[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.rpc('get_feed_items', {
    p_user_id: user.id,
    p_offset: offset,
    p_limit: FEED_PAGE_SIZE,
  });

  if (error) throw new Error(error.message);
  return (data ?? []) as FeedItem[];
}
