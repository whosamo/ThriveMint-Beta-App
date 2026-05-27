import { useState, useCallback, useRef, useEffect } from 'react';
import { FeedItem } from '../types/feed';
import { fetchFeedPage, FEED_PAGE_SIZE } from '../services/feedService';
import { rankFeedItems } from '../services/rankingService';

export interface UseFeedResult {
  items: FeedItem[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

export function useFeed(): UseFeedResult {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const busyRef = useRef(false);

  const load = useCallback(async (reset: boolean) => {
    if (busyRef.current) return;
    busyRef.current = true;

    if (reset) {
      setIsLoading(true);
      offsetRef.current = 0;
    } else {
      setIsLoadingMore(true);
    }

    try {
      const page = await fetchFeedPage(offsetRef.current);
      const ranked = await rankFeedItems(page);
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

  const refresh = useCallback(() => load(true), [load]);

  const loadMore = useCallback((): Promise<void> => {
    if (!hasMore || isLoadingMore || isLoading) return Promise.resolve();
    return load(false);
  }, [hasMore, isLoadingMore, isLoading, load]);

  return { items, isLoading, isLoadingMore, hasMore, error, refresh, loadMore };
}
