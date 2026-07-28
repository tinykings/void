'use client';

import { useCallback, useEffect, useState } from 'react';
import { findExactIgdbGameByTitle, getSteamGamePrice } from '@/lib/igdb';
import type { GamePrice } from '@/lib/types';

type UseGamePriceOptions = {
  enabled: boolean;
  isOnline: boolean;
  steamAppId?: number;
  title: string;
};

export const useGamePrice = ({ enabled, isOnline, steamAppId, title }: UseGamePriceOptions) => {
  const [result, setResult] = useState<{ key: string; price: GamePrice | null } | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const normalizedTitle = title.trim().toLocaleLowerCase();
  const key = steamAppId ? `steam:${steamAppId}:us` : normalizedTitle ? `title:${normalizedTitle}:us` : '';

  const retry = useCallback(() => {
    setErrorKey(null);
    setRetryCount((count) => count + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !isOnline || !key || result?.key === key) return;

    const controller = new AbortController();
    const request = async () => {
      let resolvedSteamAppId = steamAppId;
      if (!resolvedSteamAppId) {
        const exactMatch = await findExactIgdbGameByTitle(title, controller.signal);
        resolvedSteamAppId = exactMatch?.steam_app_id;
      }
      if (!resolvedSteamAppId) return null;
      return getSteamGamePrice(resolvedSteamAppId, controller.signal);
    };

    void request()
      .then((price) => {
        if (!controller.signal.aborted) setResult({ key, price });
      })
      .catch(() => {
        if (!controller.signal.aborted) setErrorKey(key);
      });

    return () => controller.abort();
  }, [enabled, isOnline, key, result?.key, retryCount, steamAppId, title]);

  return {
    error: errorKey === key,
    isLoading: enabled && isOnline && !!key && result?.key !== key && errorKey !== key,
    price: result?.key === key ? result.price : null,
    retry,
  };
};
