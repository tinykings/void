'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppContext } from '@/context/AppContext';
import { getTrending, searchMedia } from '@/lib/tmdb';
import { Media } from '@/lib/types';
import { MediaCard } from '@/components/MediaCard';
import { Eye, EyeOff, LoaderCircle, Save, Search as SearchIcon, X } from 'lucide-react';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';
import { SheetDragHandle } from '@/components/SheetDragHandle';
import logoPng from '../../public/logo.png';

export const SearchSheet = () => {
  const {
    isSearchFocused,
    closeAllSheets,
    apiKey,
    isLoaded,
    watchlist,
    watched,
    gistId,
    gistToken,
    setGistId,
    setGistToken,
    syncFromGist,
    isSyncingLibrary,
  } = useAppContext();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Media[]>([]);
  const [trending, setTrending] = useState<Media[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showGistPrompt, setShowGistPrompt] = useState(false);
  const [tempGistId, setTempGistId] = useState(gistId || '');
  const [tempGistToken, setTempGistToken] = useState(gistToken || '');
  const [showToken, setShowToken] = useState(false);
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

  useEffect(() => {
    if (!showGistPrompt) return;
    queueMicrotask(() => {
      setTempGistId(gistId || '');
      setTempGistToken(gistToken || '');
      setShowToken(false);
    });
  }, [showGistPrompt, gistId, gistToken]);

  const closeSheet = () => {
    if (isLibraryEmpty) return;
    closeAllSheets();
  };
  const handleSyncFromPrompt = () => {
    const nextGistId = tempGistId.trim();
    const nextGistToken = tempGistToken.trim();

    if (!nextGistId || !nextGistToken) {
      return;
    }

    setGistId(nextGistId);
    setGistToken(nextGistToken);
    setShowGistPrompt(false);
    void syncFromGist(true);
  };
  const displayedMedia = useMemo(() => (showSearchResults ? searchResults : trending), [showSearchResults, searchResults, trending]);
  const searchControls = (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <img
        src={logoPng.src}
        alt="Void"
        className="h-10 w-10 rounded-xl object-cover blueprint-border bg-brand-bg shrink-0"
        decoding="async"
      />
      <div className="relative min-w-0 flex-1 max-w-2xl">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-cyan" size={16} />
        <input
          type="text"
          value={query}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search movies, shows..."
          className="w-full rounded-xl border border-brand-cyan/20 bg-brand-bg/90 py-2.5 pl-10 pr-11 text-sm font-medium text-white outline-none shadow-[0_0_20px_rgba(34,211,238,0.08)] ring-1 ring-brand-cyan/10 placeholder:text-brand-silver/50"
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <button
            onClick={() => setQuery('')}
            className="p-1.5 text-brand-silver transition-colors hover:text-white"
            title="Clear search"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
  const topBarClassName = isLibraryEmpty
    ? 'flex items-center justify-center gap-2 border-b border-white/5 bg-brand-bg/80 px-3 py-3 sm:px-4'
    : 'flex items-center gap-2 border-b border-white/5 bg-brand-bg/80 px-3 py-3 sm:px-4';
  const searchWrapperClassName = isLibraryEmpty ? 'flex w-full max-w-2xl items-center' : 'flex w-full items-center';

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
          transition={{ duration: 0.12, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className={isLibraryEmpty
            ? "relative w-full h-full bg-brand-bg/95 shadow-2xl overflow-hidden flex flex-col"
            : "relative w-full max-w-4xl h-[86vh] sm:h-[80vh] lg:h-[74vh] max-h-[92vh] bg-brand-bg/95 blueprint-border rounded-t-3xl shadow-2xl overflow-hidden flex flex-col"
          }
        >
          <div className={topBarClassName}>
            <div className={searchWrapperClassName}>
              {searchControls}
            </div>
            {!isLibraryEmpty && (
              <button
                onClick={closeSheet}
                className="shrink-0 rounded-lg border border-brand-cyan/25 bg-brand-cyan/10 p-2 text-brand-cyan shadow-[0_0_15px_rgba(34,211,238,0.1)] transition-all hover:border-brand-cyan/40 hover:bg-brand-cyan/20 hover:text-white"
                title="Close search"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {isLibraryEmpty && (
            <div className="px-4 pt-3 pb-2 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => setShowGistPrompt(true)}
                disabled={isSyncingLibrary}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-brand-cyan/25 bg-brand-cyan/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-cyan transition-colors hover:bg-brand-cyan/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSyncingLibrary ? (
                  <LoaderCircle size={14} className="animate-spin" />
                ) : null}
                Sync library from Gist
              </button>

              <p className="text-xs uppercase tracking-[0.2em] text-brand-silver/60 text-center">
                Search and add titles to your library
              </p>
              <p className="text-[11px] text-brand-silver/40 text-center">
                Enter your Gist ID and token to sync an existing library.
              </p>
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

        <AnimatePresence>
          {showGistPrompt && (
            <div className="fixed inset-0 z-[360] flex items-end justify-center" onClick={(e) => e.stopPropagation()}>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowGistPrompt(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />

              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-2xl bg-brand-bg/95 blueprint-border rounded-t-3xl shadow-2xl overflow-hidden flex flex-col"
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-brand-bg/80">
                  <h2 className="text-lg font-semibold text-white">Sync from Gist</h2>
                  <button
                    type="button"
                    onClick={() => setShowGistPrompt(false)}
                    className="p-2 rounded-lg bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/25 transition-all hover:bg-brand-cyan/20 hover:text-white hover:border-brand-cyan/40"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-brand-silver mb-2">Gist ID</label>
                    <input
                      type="text"
                      value={tempGistId}
                      onChange={(e) => setTempGistId(e.target.value)}
                      placeholder="e.g. 8f7a9b2c3d4e5f6a7b8c9d0e"
                      className="w-full p-3 rounded-lg bg-brand-bg blueprint-border text-white focus:ring-1 focus:ring-brand-cyan outline-none transition-all placeholder:text-brand-silver/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-brand-silver mb-2">GitHub Token</label>
                    <div className="relative">
                      <input
                        type={showToken ? 'text' : 'password'}
                        value={tempGistToken}
                        onChange={(e) => setTempGistToken(e.target.value)}
                        placeholder="ghp_xxxxxxxxxxxx"
                        className="w-full p-3 pr-12 rounded-lg bg-brand-bg blueprint-border text-white focus:ring-1 focus:ring-brand-cyan outline-none transition-all placeholder:text-brand-silver/50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-silver hover:text-white"
                      >
                        {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSyncFromPrompt}
                    disabled={!tempGistId.trim() || !tempGistToken.trim() || isSyncingLibrary}
                    className="w-full bg-brand-cyan text-brand-bg font-black py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-brand-cyan/90 active:scale-95 transition-all uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSyncingLibrary ? <LoaderCircle size={18} className="animate-spin" /> : <Save size={18} />}
                    {isSyncingLibrary ? 'Syncing' : 'Save and sync'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  );
};
