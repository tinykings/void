'use client';

import { useEffect, useState } from 'react';
import { findExactIgdbGameByTitle, getSteamGamePrices } from '@/lib/igdb';
import { getSteamAppId } from '@/lib/ggDeals';
import { sortGameDeals, type GameDeal } from '@/lib/gameDeals';
import { mapWithConcurrency } from '@/lib/concurrency';
import { getMediaTitle } from '@/lib/media';
import type { Media } from '@/lib/types';

const PRICE_BATCH_SIZE = 50;
const STEAM_ID_LOOKUP_CONCURRENCY = 2;

type UseGameDealsOptions = {
  enabled: boolean;
  isOnline: boolean;
  playlist: Media[];
};

export const useGameDeals = ({ enabled, isOnline, playlist }: UseGameDealsOptions) => {
  const [deals, setDeals] = useState<GameDeal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [failureCount, setFailureCount] = useState(0);
  const [unavailableCount, setUnavailableCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    if (!enabled || !isOnline || playlist.length === 0) return () => controller.abort();

    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setIsLoading(true);
      setFailureCount(0);
      setUnavailableCount(0);
    });

    const request = async () => {
      // Older playlist records may predate stored Steam IDs. Resolve those by
      // title exactly as game details does before requesting prices in batches.
      const resolvedGames = await mapWithConcurrency(playlist, STEAM_ID_LOOKUP_CONCURRENCY, async (media) => {
        const storedSteamAppId = getSteamAppId(media);
        if (storedSteamAppId) return { media, steamAppId: storedSteamAppId, failed: false };

        try {
          const match = await findExactIgdbGameByTitle(getMediaTitle(media), controller.signal);
          return { media, steamAppId: match?.steam_app_id, failed: false };
        } catch (error) {
          if (controller.signal.aborted) throw error;
          return { media, steamAppId: undefined, failed: true };
        }
      });

      const mediaBySteamId = new Map<number, Media>();
      resolvedGames.forEach(({ media, steamAppId }) => {
        if (steamAppId && !mediaBySteamId.has(steamAppId)) mediaBySteamId.set(steamAppId, media);
      });
      const steamAppIds = [...mediaBySteamId.keys()];
      const lookupFailureCount = resolvedGames.filter((game) => game.failed).length;
      const unmatchedCount = resolvedGames.filter((game) => !game.failed && !game.steamAppId).length;

      if (steamAppIds.length === 0) {
        return { deals: [], failureCount: lookupFailureCount, unavailableCount: unmatchedCount };
      }

      const batches = Array.from(
        { length: Math.ceil(steamAppIds.length / PRICE_BATCH_SIZE) },
        (_, index) => steamAppIds.slice(index * PRICE_BATCH_SIZE, (index + 1) * PRICE_BATCH_SIZE),
      );
      const results = await Promise.all(batches.map(async (ids) => {
        try {
          return { ids, prices: await getSteamGamePrices(ids, controller.signal), failed: false };
        } catch (error) {
          if (controller.signal.aborted) throw error;
          return { ids, prices: [], failed: true };
        }
      }));

      const prices = results.flatMap((result) => result.prices);
      const nextDeals = prices.flatMap((price) => {
        const media = mediaBySteamId.get(price.steamAppId);
        return media && price.lowestCurrent ? [{ media, price }] : [];
      });
      const failedPriceIds = results.filter((result) => result.failed).reduce((count, result) => count + result.ids.length, 0);
      const returnedIds = new Set(prices.map((price) => price.steamAppId));
      const successfulIds = results.filter((result) => !result.failed).flatMap((result) => result.ids);

      return {
        deals: sortGameDeals(nextDeals),
        failureCount: lookupFailureCount + failedPriceIds,
        unavailableCount: unmatchedCount + successfulIds.filter((id) => !returnedIds.has(id)).length,
      };
    };

    void request()
      .then((result) => {
        if (controller.signal.aborted) return;
        setDeals(result.deals);
        setFailureCount(result.failureCount);
        setUnavailableCount(result.unavailableCount);
      })
      .catch((error) => {
        if (!controller.signal.aborted) console.error('Game prices error:', error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [enabled, isOnline, playlist]);

  const canLoad = enabled && isOnline && playlist.length > 0;
  return {
    deals: canLoad ? deals : [],
    failureCount: canLoad ? failureCount : 0,
    isLoading: canLoad && isLoading,
    unavailableCount: canLoad ? unavailableCount : 0,
  };
};
