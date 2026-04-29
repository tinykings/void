'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppContext } from '@/context/AppContext';
import { getTrending, searchMedia } from '@/lib/tmdb';
import { Media } from '@/lib/types';
import { MediaCard } from '@/components/MediaCard';
import { Search as SearchIcon, X } from 'lucide-react';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';
import { SheetDragHandle } from '@/components/SheetDragHandle';

export const SearchSheet = () => {
  const { isSearchFocused, setIsSearchFocused, apiKey, isLoaded, watchlist, watched, vidAngelEnabled } = useAppContext();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Media[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [trending, setTrending] = useState<Media[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchAbortController = useRef<AbortController | null>(null);

  const searchTerm = query.trim();
  const showSearchResults = searchTerm.length >= 2;
  const isLibraryEmpty = watchlist.length === 0 && watched.length === 0;

  const runSearch = useCallback(async (value: string) => {
    if (!apiKey || value.trim().length < 2) {
      setSearchResults((current) => (current.length === 0 ? current : []));
      return;
    }

    if (searchAbortController.current) searchAbortController.current.abort();
    searchAbortController.current = new AbortController();

    setSearchLoading(true);
    try {
      const results = await searchMedia(value, apiKey, searchAbortController.current.signal);
      setSearchResults(results);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearchLoading(false);
    }
  }, [apiKey]);

  const debouncedSearch = useDebouncedCallback(runSearch, 300);

  useEffect(() => {
    if (!isSearchFocused) return;
    if (!apiKey || !isLoaded) return;
    if (trending.length > 0) return;

    setTrendingLoading(true);
    getTrending(apiKey, 'all')
      .then((items) => {
        const processed = items.map((item) => ({
          ...item,
          media_type: item.media_type || 'movie',
        })) as Media[];
        setTrending(processed);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load popular titles'))
      .finally(() => setTrendingLoading(false));
  }, [apiKey, isLoaded, isSearchFocused, trending.length]);

  useEffect(() => {
    if (!isSearchFocused) return;

    if (searchTerm.length >= 2) {
      debouncedSearch(query);
    } else {
      setSearchResults([]);
      if (searchAbortController.current) searchAbortController.current.abort();
    }
  }, [query, searchTerm.length, debouncedSearch, isSearchFocused]);

  useEffect(() => {
    return () => {
      if (searchAbortController.current) searchAbortController.current.abort();
    };
  }, []);

  useEffect(() => {
    if (!isSearchFocused) {
      setError(null);
    }
  }, [isSearchFocused]);

  const closeSheet = () => {
    if (isLibraryEmpty) return;
    setIsSearchFocused(false);
  };
  const displayedMedia = useMemo(() => (showSearchResults ? searchResults : trending), [showSearchResults, searchResults, trending]);

  if (!isSearchFocused) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[340] flex items-end justify-center" onClick={isLibraryEmpty ? undefined : closeSheet}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className={isLibraryEmpty
            ? "relative w-full h-full bg-brand-bg/95 shadow-2xl overflow-hidden flex flex-col"
            : "relative w-full max-w-4xl h-[86vh] sm:h-[80vh] lg:h-[74vh] max-h-[92vh] bg-brand-bg/95 blueprint-border rounded-t-3xl shadow-2xl overflow-hidden flex flex-col"
          }
        >
          {!isLibraryEmpty && (
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-brand-bg/80">
              <h2 className="text-lg font-black text-white uppercase tracking-tight leading-tight">Search</h2>
              <button
                onClick={closeSheet}
                className="p-2 text-brand-silver hover:text-white transition-colors bg-white/5 rounded-full"
              >
                <X size={18} />
              </button>
            </div>
          )}

          <div className="p-4 pb-2">
            <div className="relative">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-cyan" size={20} />
              <input
                type="text"
                value={query}
                autoFocus
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search movies, shows..."
                className="w-full pl-12 pr-12 bg-brand-bg blueprint-border rounded-2xl outline-none font-medium text-white placeholder:text-brand-silver/50 py-4 text-base shadow-[0_0_30px_rgba(34,211,238,0.15)] ring-1 ring-brand-cyan/30"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  onClick={() => setQuery('')}
                  className="p-2 text-brand-silver hover:text-white transition-colors"
                  title="Clear search"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </div>

          <div className="px-4 pb-24 overflow-y-auto custom-scrollbar flex-1">

            {error && (
              <p className="text-sm text-red-400 mb-4">{error}</p>
            )}

            {trendingLoading && !showSearchResults ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="aspect-[2/3] rounded-xl bg-white/10 animate-pulse" />
                ))}
              </div>
            ) : displayedMedia.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {displayedMedia.map((item) => (
                  <MediaCard
                    key={`${item.media_type}-${item.id}`}
                    media={item}
                    showBadge={vidAngelEnabled}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-brand-silver text-center py-16">
                {showSearchResults ? 'Try a different search term.' : 'No titles to show.'}
              </p>
            )}

            {isLibraryEmpty && (
              <div className="pt-10 pb-4 text-center text-xs uppercase tracking-[0.2em] text-brand-silver/60">
                Data provided by TMDB.
              </div>
            )}
          </div>

          <SheetDragHandle onClose={closeSheet} />
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
