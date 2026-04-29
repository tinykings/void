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
import logoPng from '../../public/logo.png';

export const SearchSheet = () => {
  const { isSearchFocused, setIsSearchFocused, closeAllSheets, apiKey, isLoaded, watchlist, watched, vidAngelEnabled } = useAppContext();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Media[]>([]);
  const [trending, setTrending] = useState<Media[]>([]);
  const [error, setError] = useState<string | null>(null);
  const searchAbortController = useRef<AbortController | null>(null);

  const searchTerm = query.trim();
  const showSearchResults = searchTerm.length >= 2;
  const isLibraryEmpty = watchlist.length === 0 && watched.length === 0;
  const trendingLoading = isSearchFocused && !!apiKey && isLoaded && trending.length === 0 && !showSearchResults;
  const displayError = isSearchFocused ? error : null;

  const runSearch = useCallback(async (value: string) => {
    if (!apiKey || value.trim().length < 2) {
      return;
    }

    if (searchAbortController.current) searchAbortController.current.abort();
    searchAbortController.current = new AbortController();

    try {
      const results = await searchMedia(value, apiKey, searchAbortController.current.signal);
      setSearchResults(results);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
    }
  }, [apiKey]);

  const debouncedSearch = useDebouncedCallback(runSearch, 300);

  useEffect(() => {
    if (!isSearchFocused) return;
    if (!apiKey || !isLoaded) return;
    if (trending.length > 0) return;

    getTrending(apiKey, 'all')
      .then((items) => {
        const processed = items.map((item) => ({
          ...item,
          media_type: item.media_type || 'movie',
        })) as Media[];
        setTrending(processed);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load popular titles'))
  }, [apiKey, isLoaded, isSearchFocused, trending.length]);

  useEffect(() => {
    if (!isSearchFocused) return;

    if (searchTerm.length >= 2) {
      debouncedSearch(query);
    } else if (searchAbortController.current) {
      searchAbortController.current.abort();
    }
  }, [query, searchTerm.length, debouncedSearch, isSearchFocused]);

  useEffect(() => {
    return () => {
      if (searchAbortController.current) searchAbortController.current.abort();
    };
  }, []);

  const closeSheet = () => {
    if (isLibraryEmpty) return;
    closeAllSheets();
  };
  const displayedMedia = useMemo(() => (showSearchResults ? searchResults : trending), [showSearchResults, searchResults, trending]);

  if (!isSearchFocused) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[340] flex items-end justify-center" onClick={closeAllSheets}>
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
                className="p-2 rounded-lg bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/25 shadow-[0_0_15px_rgba(34,211,238,0.1)] transition-all hover:bg-brand-cyan/20 hover:text-white hover:border-brand-cyan/40"
                >
                  <X size={18} />
                </button>
            </div>
          )}

          {isLibraryEmpty ? (
            <div className="px-4 pt-5 pb-3">
              <div className="flex items-center gap-4">
                <img
                  src={logoPng.src}
                  alt="Void"
                  className="h-20 w-20 rounded-2xl object-cover blueprint-border bg-brand-bg shrink-0"
                  decoding="async"
                />
                <div className="relative flex-1">
                  <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-cyan" size={20} />
                  <input
                    type="text"
                    value={query}
                    autoFocus
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="VOID: Search and add to your library"
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
            </div>
          ) : (
            <div className="p-4 pb-2">
              <div className="flex items-center gap-4">
                <img
                  src={logoPng.src}
                  alt="Void"
                  className="h-20 w-20 rounded-2xl object-cover blueprint-border bg-brand-bg shrink-0"
                  decoding="async"
                />
                <div className="relative flex-1">
                  <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-cyan" size={20} />
                  <input
                    type="text"
                    value={query}
                    autoFocus
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="VOID: Search and add to your library"
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
            </div>
          )}

          <div className="px-4 pb-24 overflow-y-auto custom-scrollbar flex-1">

            {displayError && (
              <p className="text-sm text-red-400 mb-4">{displayError}</p>
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
                    showReleaseBadge={false}
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

          {!isLibraryEmpty && <SheetDragHandle onClose={closeSheet} />}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
