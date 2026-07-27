'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getIgdbGameDetails } from '@/lib/igdb';
import { getMediaKey, getMediaSource } from '@/lib/media';
import { getMediaDetails } from '@/lib/tmdb';
import type { Media } from '@/lib/types';

type UpdateMediaMetadata = (
  id: number,
  type: Media['media_type'],
  metadata: Partial<Media>,
  source?: Media['source'],
) => void;

type UseMediaDetailsOptions = {
  activeMedia: Media | null;
  apiKey: string;
  isOnline: boolean;
  updateMediaMetadata: UpdateMediaMetadata;
};

export const useMediaDetails = ({ activeMedia, apiKey, isOnline, updateMediaMetadata }: UseMediaDetailsOptions) => {
  const [details, setDetails] = useState<{ key: string; media: Media } | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const attemptRef = useRef('');
  const activeKey = activeMedia ? getMediaKey(activeMedia) : '';

  const retry = useCallback(() => {
    setErrorKey(null);
    setRetryCount((count) => count + 1);
  }, []);

  useEffect(() => {
    if (!activeMedia) {
      attemptRef.current = '';
      return;
    }
    if (!isOnline) return;
    if (activeMedia.media_type !== 'game' && !apiKey) return;

    const source = getMediaSource(activeMedia);
    const requestKey = getMediaKey(activeMedia);
    const hasCurrentDetails = details?.key === requestKey;
    const needsHltbRefresh = hasCurrentDetails
      && activeMedia.media_type === 'game'
      && source === 'igdb'
      && !details.media.hltb_checked_at;
    if (hasCurrentDetails && !needsHltbRefresh) return;

    const attemptKey = `${requestKey}:${retryCount}`;
    if (attemptRef.current === attemptKey) return;
    attemptRef.current = attemptKey;

    const controller = new AbortController();
    const request = activeMedia.media_type === 'game'
      ? source === 'steam'
        ? Promise.resolve(activeMedia)
        : getIgdbGameDetails(activeMedia.id, controller.signal)
      : getMediaDetails(activeMedia.id, activeMedia.media_type, apiKey, controller.signal);

    void request
      .then((mediaData) => {
        if (controller.signal.aborted) return;
        setDetails({ key: requestKey, media: mediaData });
        updateMediaMetadata(mediaData.id, mediaData.media_type, {
          ...mediaData,
          lastChecked: Date.now(),
        }, getMediaSource(mediaData));
      })
      .catch(() => {
        if (!controller.signal.aborted) setErrorKey(requestKey);
      });

    return () => controller.abort();
  }, [activeMedia, apiKey, details, isOnline, retryCount, updateMediaMetadata]);

  return {
    errorKey,
    isResolved: !!activeMedia && details?.key === activeKey,
    retry,
    selected: activeMedia && details?.key === activeKey ? details.media : activeMedia,
  };
};
