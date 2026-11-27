'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { searchMedia } from '@/lib/tmdb';
import { useMediaDiscovery } from '@/hooks/useMediaDiscovery';
import { rankSearchResults } from '@/lib/searchRanking';
import type { Media } from '@/lib/types';

type UseMediaSearchOptions = {
  apiKey: string;
  enabled: boolean;
  isLoaded: boolean;
  isOnline: boolean;
};

export const useMediaSearch = ({ apiKey, enabled, isLoaded, isOnline }: UseMediaSearchOptions) => {
  const discovery = useMediaDiscovery({ apiKey, enabled, isLoaded, isOnline });
  const [searchResults, setSearchResults] = useState<Media[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSubmittedSearch, setHasSubmittedSearch] = useState(false);
  const searchControllerRef = useRef<AbortController | null>(null);

  const runSearch = useCallback(async (value: string) => {
    if (!isOnline) {
      setError('Search is unavailable offline.');
      return;
    }
    if (value.trim().length < 2) return;

    searchControllerRef.current?.abort();
    const controller = new AbortController();
    searchControllerRef.current = controller;

    try {
      setError(null);
      setIsSearching(true);
      setHasSubmittedSearch(true);
      if (!apiKey) throw new Error('Movie and show search needs a configured TMDB connection.');
      const results = await searchMedia(value, apiKey, controller.signal);
      if (controller.signal.aborted) return;
      setSearchResults(rankSearchResults(results, value));
    } catch (searchError: unknown) {
      if (searchError instanceof Error && searchError.name === 'AbortError') return;
      console.error('Search error:', searchError);
      setError(searchError instanceof Error ? searchError.message : 'Search failed');
    } finally {
      if (searchControllerRef.current === controller) setIsSearching(false);
    }
  }, [apiKey, isOnline]);

  const clearSearch = useCallback(() => {
    searchControllerRef.current?.abort();
    searchControllerRef.current = null;
    setSearchResults([]);
    setHasSubmittedSearch(false);
    setError(null);
    setIsSearching(false);
  }, []);

  useEffect(() => () => searchControllerRef.current?.abort(), []);

  return {
    clearSearch,
    displayedMedia: hasSubmittedSearch ? searchResults : discovery.items,
    error: hasSubmittedSearch ? error : discovery.error,
    retryDiscovery: discovery.retry,
    hasSubmittedSearch,
    isSearching,
    runSearch,
    trendingLoading: discovery.isLoading && !hasSubmittedSearch,
  };
};
