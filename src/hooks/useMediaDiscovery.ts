'use client';

import { useCallback, useEffect, useState } from 'react';
import { discoveryDay, mixDiscovery } from '@/lib/discovery';
import { getTrending, getUpcomingMedia } from '@/lib/tmdb';
import type { Media } from '@/lib/types';

type Options = {
  apiKey: string;
  enabled: boolean;
  isLoaded: boolean;
  isOnline: boolean;
};

type DiscoveryResult = { key: string; items: Media[]; failures: number };

export const useMediaDiscovery = ({ apiKey, enabled, isLoaded, isOnline }: Options) => {
  const [day, setDay] = useState(() => discoveryDay());
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const key = JSON.stringify([apiKey, day, attempt]);
  const ready = enabled && isLoaded && isOnline && !!apiKey;
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  // A feed left open overnight must not keep yesterday's releases or countdowns.
  useEffect(() => {
    if (!enabled) return;
    const updateDay = () => setDay(discoveryDay());
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const timer = window.setTimeout(updateDay, Math.max(1, midnight.getTime() - Date.now()));
    window.addEventListener('focus', updateDay);
    document.addEventListener('visibilitychange', updateDay);
    updateDay();
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', updateDay);
      document.removeEventListener('visibilitychange', updateDay);
    };
  }, [enabled, day]);

  useEffect(() => {
    if (!ready || result?.key === key) return;
    const controller = new AbortController();
    const now = new Date();
    void Promise.allSettled([
      getTrending(apiKey, 'all', controller.signal),
      getUpcomingMedia('movie', apiKey, controller.signal, now),
      getUpcomingMedia('tv', apiKey, controller.signal, now),
    ]).then((responses) => {
      if (controller.signal.aborted) return;
      const [trending, movies, shows] = responses.map((response) => response.status === 'fulfilled' ? response.value : []);
      setResult({
        key,
        items: mixDiscovery(trending, movies, shows, now),
        failures: responses.filter((response) => response.status === 'rejected').length,
      });
    });
    return () => controller.abort();
  }, [apiKey, key, ready, result?.key]);

  const current = result?.key === key ? result : null;
  return {
    items: current?.items || [],
    isLoading: ready && !current,
    error: current?.failures ? current.items.length > 0 ? 'Some discovery titles couldn’t load.' : 'Discovery couldn’t load.' : null,
    retry,
  };
};
