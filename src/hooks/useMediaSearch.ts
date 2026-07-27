'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getTrending, searchMedia } from '@/lib/tmdb';
import { hasGameApi, searchIgdbGames } from '@/lib/igdb';
import { rankSearchResults } from '@/lib/searchRanking';
import type { Media } from '@/lib/types';

type UseMediaSearchOptions = {
  apiKey: string;
  enabled: boolean;
  isLoaded: boolean;
  isOnline: boolean;
};

export const useMediaSearch = ({ apiKey, enabled, isLoaded, isOnline }: UseMediaSearchOptions) => {
  const [searchResults, setSearchResults] = useState<Media[]>([]);
  const [trending, setTrending] = useState<Media[]>([]);
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
      const [tmdbResult, gameResult] = await Promise.allSettled([
        apiKey ? searchMedia(value, apiKey, controller.signal) : Promise.resolve([] as Media[]),
        hasGameApi() ? searchIgdbGames(value, controller.signal) : Promise.resolve([] as Media[]),
      ]);
      if (controller.signal.aborted) return;

      const tmdbResults = tmdbResult.status === 'fulfilled' ? tmdbResult.value : [];
      const gameResults = gameResult.status === 'fulfilled' ? gameResult.value : [];
      setSearchResults(rankSearchResults([...tmdbResults, ...gameResults], value));

      if (tmdbResult.status === 'rejected') console.error('TMDB search error:', tmdbResult.reason);
      if (gameResult.status === 'rejected') {
        console.error('Game search error:', gameResult.reason);
        if (tmdbResults.length === 0) {
          setError(gameResult.reason instanceof Error ? gameResult.reason.message : 'Game search failed');
        }
      }
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

  useEffect(() => {
    if (!isOnline || !enabled || !apiKey || !isLoaded || trending.length > 0) return;

    const controller = new AbortController();
    void getTrending(apiKey, 'all', controller.signal)
      .then((items) => {
        if (controller.signal.aborted) return;
        setTrending(items.map((item) => ({
          ...item,
          media_type: item.media_type || 'movie',
        })) as Media[]);
      })
      .catch((trendingError) => {
        if (!controller.signal.aborted) {
          setError(trendingError instanceof Error ? trendingError.message : 'Failed to load popular titles');
        }
      });

    return () => controller.abort();
  }, [apiKey, enabled, isLoaded, isOnline, trending.length]);

  useEffect(() => () => searchControllerRef.current?.abort(), []);

  return {
    clearSearch,
    displayedMedia: hasSubmittedSearch ? searchResults : trending,
    error,
    hasSubmittedSearch,
    isSearching,
    runSearch,
    trendingLoading: isOnline && enabled && !!apiKey && isLoaded && trending.length === 0 && !hasSubmittedSearch,
  };
};
