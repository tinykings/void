'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getRecommendations } from '@/lib/tmdb';
import { getMediaKey } from '@/lib/media';
import type { Media } from '@/lib/types';
import { MediaCard } from './MediaCard';
import { MediaCardSkeleton } from './MediaCardSkeleton';

const shuffled = <T,>(items: T[]) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

type Recommendation = { media: Media; source: string };

export const HomeRecommendationsSection = () => {
  const { watched, watchlist, apiKey } = useAppContext();
  const isOnline = useOnlineStatus();
  const [result, setResult] = useState<{ seeds: string; items: Recommendation[] }>({ seeds: '', items: [] });
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  // Stable through unrelated library/metadata changes; never use games as seeds.
  const seeds = JSON.stringify(watched.filter((item) => item.isFavorite && item.media_type !== 'game')
    .map((item) => ({ id: item.id, type: item.media_type as 'movie' | 'tv', title: item.title || item.name || 'Untitled' }))
    .sort((a, b) => a.type.localeCompare(b.type) || a.id - b.id));
  const savedKeys = useMemo(() => new Set([...watchlist, ...watched].map(getMediaKey)), [watchlist, watched]);
  const hasSeeds = seeds !== '[]';

  useEffect(() => {
    if (!isOnline || !apiKey || !hasSeeds) return;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setFailed(false);
      const selection: Recommendation[] = [];
      const seen = new Set<string>();
      let anyFailed = false;
      const favorites = JSON.parse(seeds) as { id: number; type: 'movie' | 'tv'; title: string }[];
      for (const seed of shuffled(favorites)) {
        if (selection.length >= 50 || controller.signal.aborted) break;
        try {
          const results = await getRecommendations(seed.id, seed.type, apiKey, controller.signal);
          let picked = 0;
          for (const media of shuffled(results)) {
            const key = getMediaKey(media);
            if (savedKeys.has(key) || seen.has(key)) continue;
            seen.add(key);
            selection.push({ media, source: seed.title });
            if (++picked === 5 || selection.length === 50) break;
          }
        } catch {
          if (controller.signal.aborted) return;
          anyFailed = true;
        }
      }
      if (controller.signal.aborted) return;
      if (selection.length || !anyFailed) setResult({ seeds, items: selection.sort((a, b) => b.media.popularity - a.media.popularity) });
      setFailed(anyFailed);
      setLoading(false);
    };
    void load();
    return () => controller.abort();
    // Library additions are filtered immediately below without reshuffling this feed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeds, hasSeeds, apiKey, isOnline, refresh]);

  const visible = hasSeeds && result.seeds === seeds ? result.items.filter(({ media }) => !savedKeys.has(getMediaKey(media)) && media.media_type !== 'game') : [];
  return (
    <section aria-label="Recommendations" className="space-y-4">
      <div className="flex items-center justify-between gap-3 px-1">
        <h1 className="type-title text-white">Recommendations</h1>
        {hasSeeds && <button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={!isOnline || loading} className="type-action min-h-11 rounded-lg px-3 text-brand-cyan disabled:opacity-40">Refresh</button>}
      </div>
      {!hasSeeds && <p className="px-1 text-sm text-brand-silver">Favorite movies or shows in History to get recommendations.</p>}
      {!isOnline && <p role="status" className="px-1 text-sm text-brand-silver">Reconnect to load recommendations. Your library remains available.</p>}
      {hasSeeds && !apiKey && <p role="status" className="px-1 text-sm text-brand-silver">Movie and show recommendations need a configured TMDB connection.</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {visible.map(({ media, source }) => <div key={getMediaKey(media)}>
          <MediaCard media={media} indicatorContext="search" showCaption showReleaseBadge={false} />
          <p className="px-1 pb-3 text-xs text-brand-cyan">{source}</p>
        </div>)}
        {hasSeeds && loading && visible.length === 0 && Array.from({ length: 6 }, (_, index) => <MediaCardSkeleton key={index} />)}
      </div>
      {hasSeeds && loading && <p role="status" className="px-1 text-sm text-brand-silver">Finding recommendations…</p>}
      {hasSeeds && failed && <div role="status" className="px-1 text-sm text-brand-silver">Some recommendations couldn’t load. <button type="button" disabled={loading || !isOnline} onClick={() => setRefresh((value) => value + 1)} className="min-h-11 px-2 text-brand-cyan disabled:opacity-40">Try again</button></div>}
      {hasSeeds && isOnline && apiKey && !loading && !failed && visible.length === 0 && <p className="px-1 text-sm text-brand-silver">No new recommendations right now. Try adding more Favorites.</p>}
    </section>
  );
};
