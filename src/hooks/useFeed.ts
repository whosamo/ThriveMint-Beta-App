import { useState, useCallback, useRef, useEffect } from 'react';
import { FeedItem } from '../types/feed';
import { BriefMatchContext } from '../types/brief';
import { fetchFeedPage, FEED_PAGE_SIZE } from '../services/feedService';
import { rankFeedItems } from '../services/rankingService';
import { getBlockedUserIds } from '../services/safetyService';

export interface UseFeedResult {
  items: FeedItem[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  removeItem: (userId: string) => void;
}

export function useFeed(briefContext?: BriefMatchContext | null): UseFeedResult {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const busyRef = useRef(false);
  const briefContextRef = useRef(briefContext);
  briefContextRef.current = briefContext;
  const blockedIdsRef = useRef<Set<string>>(new Set());

  // Load blocked IDs once on mount so feed filtering stays current
  useEffect(() => {
    getBlockedUserIds().then(ids => { blockedIdsRef.current = new Set(ids); });
  }, []);

  const load = useCallback(async (reset: boolean) => {
    if (busyRef.current) return;
    busyRef.current = true;

    if (reset) {
      setIsLoading(true);
      offsetRef.current = 0;
      // Refresh blocked list on explicit refresh too
      const ids = await getBlockedUserIds().catch(() => [] as string[]);
      blockedIdsRef.current = new Set(ids);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const page = await fetchFeedPage(offsetRef.current);
      const unblocked = page.filter(item => !blockedIdsRef.current.has(item.user_id));
      const ranked = await rankFeedItems(
        unblocked,
        briefContextRef.current ? { briefContext: briefContextRef.current } : undefined,
      );
      setItems(prev => (reset ? ranked : [...prev, ...ranked]));
      setHasMore(page.length === FEED_PAGE_SIZE);
      offsetRef.current += page.length;
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load feed');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      busyRef.current = false;
    }
  }, []);

  useEffect(() => { load(true); }, [load]);

  useEffect(() => {
    if (briefContext) load(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefContext?.brief_title]);

  const refresh = useCallback(() => load(true), [load]);

  const loadMore = useCallback((): Promise<void> => {
    if (!hasMore || isLoadingMore || isLoading) return Promise.resolve();
    return load(false);
  }, [hasMore, isLoadingMore, isLoading, load]);

  // Immediately remove a user from the visible feed (after block)
  const removeItem = useCallback((userId: string) => {
    blockedIdsRef.current.add(userId);
    setItems(prev => prev.filter(item => item.user_id !== userId));
  }, []);

  return { items, isLoading, isLoadingMore, hasMore, error, refresh, loadMore, removeItem };
}
