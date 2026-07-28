'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getContentRating,
  getMediaCredits,
  getUSStreamingProviders,
  getWatchProviders,
} from '@/lib/tmdb';
import type { CastMember, Media, WatchProvider } from '@/lib/types';

type KeyedItems<T> = { key: string; items: T[] } | null;
type UseDetailsSupplementaryDataOptions = {
  activeKey: string;
  activeMedia: Media | null;
  apiKey: string;
  enabled: boolean;
  isOnline: boolean;
};

export const useDetailsSupplementaryData = ({
  activeKey,
  activeMedia,
  apiKey,
  enabled,
  isOnline,
}: UseDetailsSupplementaryDataOptions) => {
  const [cast, setCast] = useState<KeyedItems<CastMember>>(null);
  const [watchProviders, setWatchProviders] = useState<KeyedItems<WatchProvider>>(null);
  const [contentRating, setContentRating] = useState<{ key: string; value: string | null } | null>(null);
  const [sectionErrors, setSectionErrors] = useState<Set<string>>(new Set());
  const [retryCount, setRetryCount] = useState(0);

  const retrySection = useCallback((section: string) => {
    setSectionErrors((previous) => {
      const next = new Set(previous);
      next.delete(`${activeKey}:${section}`);
      return next;
    });
    setRetryCount((count) => count + 1);
  }, [activeKey]);

  useEffect(() => {
    if (!enabled || !isOnline || !activeMedia || !apiKey || activeMedia.media_type === 'game') return;

    const controller = new AbortController();
    const mediaType = activeMedia.media_type;
    const requestKey = activeKey;

    void Promise.all([
      watchProviders?.key === requestKey
        ? Promise.resolve()
        : getWatchProviders(activeMedia.id, mediaType, apiKey, controller.signal)
            .then((data) => {
              if (!controller.signal.aborted) setWatchProviders({ key: requestKey, items: getUSStreamingProviders(data) });
            })
            .catch(() => {
              if (!controller.signal.aborted) setSectionErrors((previous) => new Set(previous).add(`${requestKey}:overview`));
            }),
      cast?.key === requestKey
        ? Promise.resolve()
        : getMediaCredits(activeMedia.id, mediaType, apiKey, controller.signal)
            .then((data) => {
              if (!controller.signal.aborted) setCast({ key: requestKey, items: data.cast.slice(0, 6) });
            })
            .catch(() => {
              if (!controller.signal.aborted) setSectionErrors((previous) => new Set(previous).add(`${requestKey}:cast`));
            }),
    ]);

    return () => controller.abort();
  }, [activeKey, activeMedia, apiKey, cast?.key, enabled, isOnline, retryCount, watchProviders?.key]);

  useEffect(() => {
    if (!isOnline || !activeMedia || !apiKey || activeMedia.media_type === 'game') return;

    const controller = new AbortController();
    const mediaType = activeMedia.media_type;
    void getContentRating(activeMedia.id, mediaType, apiKey, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setContentRating({ key: activeKey, value });
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [activeKey, activeMedia, apiKey, isOnline]);

  return {
    castItems: cast?.key === activeKey ? cast.items : [],
    castKey: cast?.key,
    contentRatingValue: contentRating?.key === activeKey ? contentRating.value : null,
    retrySection,
    sectionErrors,
    watchProviderItems: watchProviders?.key === activeKey ? watchProviders.items : [],
  };
};
