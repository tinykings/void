'use client';

import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { METADATA_POLL_INTERVAL_MS } from '@/lib/metadataRefresh';
import type { Media } from '@/lib/types';

type Options = {
  enabled: boolean;
  watchlist: Media[];
  watched: Media[];
  refreshLibraryMetadata: () => Promise<Media[]>;
};

export const useLibraryMetadataRefresh = ({ enabled, watchlist, watched, refreshLibraryMetadata }: Options) => {
  const inFlight = useRef(false);
  const refresh = useCallback(async () => {
    if (!enabled || inFlight.current || document.visibilityState !== 'visible') return;
    inFlight.current = true;
    try {
      const migrated = await refreshLibraryMetadata();
      for (const item of migrated) {
        toast(item.name || item.title, { description: 'Moved to playlist, new episode airing soon' });
      }
    } catch (error) {
      // Background work must never block the cached library or Gist sync.
      console.error('Could not refresh library metadata:', error);
    } finally {
      inFlight.current = false;
    }
  }, [enabled, refreshLibraryMetadata]);

  // Also hydrates newly synced/added items. Successful fetches age the cache even
  // when TMDB has no poster, avoiding the old missing-poster retry loop.
  useEffect(() => { void refresh(); }, [refresh, watchlist, watched]);

  useEffect(() => {
    if (!enabled) return;
    const onForeground = () => { void refresh(); };
    window.addEventListener('focus', onForeground);
    document.addEventListener('visibilitychange', onForeground);
    const timer = window.setInterval(onForeground, METADATA_POLL_INTERVAL_MS);
    return () => {
      window.removeEventListener('focus', onForeground);
      document.removeEventListener('visibilitychange', onForeground);
      window.clearInterval(timer);
    };
  }, [enabled, refresh]);
};
