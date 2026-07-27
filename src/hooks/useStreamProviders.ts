'use client';

import { useEffect, useState } from 'react';
import { mapWithConcurrency } from '@/lib/concurrency';
import { getContentRating, getUSStreamingProviders, getWatchProviders } from '@/lib/tmdb';
import { groupStreamProviderResults, type StreamProviderGroup, type StreamableMedia } from '@/lib/streamProviders';

const STREAM_PROVIDER_CONCURRENCY = 2;

type UseStreamProvidersOptions = {
  apiKey: string;
  enabled: boolean;
  isOnline: boolean;
  playlist: StreamableMedia[];
};

export const useStreamProviders = ({ apiKey, enabled, isOnline, playlist }: UseStreamProvidersOptions) => {
  const [groups, setGroups] = useState<StreamProviderGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [failureCount, setFailureCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    if (!enabled || !isOnline || playlist.length === 0 || !apiKey) {
      return () => controller.abort();
    }

    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setIsLoading(true);
        setFailureCount(0);
      }
    });

    void mapWithConcurrency(playlist, STREAM_PROVIDER_CONCURRENCY, async (item) => {
      let failed = false;
      const providerPromise = getWatchProviders(item.id, item.media_type, apiKey, controller.signal)
        .then(getUSStreamingProviders)
        .catch((error) => {
          if (controller.signal.aborted) throw error;
          failed = true;
          return [];
        });
      const contentRatingPromise = getContentRating(item.id, item.media_type, apiKey, controller.signal);
      const [providers, contentRating] = await Promise.all([providerPromise, contentRatingPromise]);
      return { item, providers, contentRating, failed };
    })
      .then((results) => {
        if (controller.signal.aborted) return;
        setGroups(groupStreamProviderResults(results));
        setFailureCount(results.filter((result) => result.failed).length);
      })
      .catch((error) => {
        if (!controller.signal.aborted) console.error('Streaming provider error:', error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [apiKey, enabled, isOnline, playlist]);

  const canLoad = enabled && isOnline && playlist.length > 0 && !!apiKey;
  return {
    failureCount: canLoad ? failureCount : 0,
    groups: canLoad ? groups : [],
    isLoading: canLoad && isLoading,
  };
};
