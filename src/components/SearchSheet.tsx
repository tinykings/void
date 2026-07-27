'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppContext } from '@/context/AppContext';
import { getTrending, searchMedia } from '@/lib/tmdb';
import { hasGameApi, searchIgdbGames } from '@/lib/igdb';
import { Media } from '@/lib/types';
import { getMediaKey } from '@/lib/media';
import { MediaCard } from '@/components/MediaCard';
import { ArrowRight, LoaderCircle, Search as SearchIcon, X } from 'lucide-react';
import { SheetDragHandle } from '@/components/SheetDragHandle';
import { FocusTrap } from '@/components/FocusTrap';
import logoPng from '../../public/logo.png';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

const normalizeSearchText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const getSearchRank = (media: Media, query: string, index: number) => {
  const title = normalizeSearchText(media.title || media.name || '');
  const search = normalizeSearchText(query);
  const popularity = media.popularity || media.vote_count || 0;

  if (!title || !search) return 10_000 + index;
  if (title === search) return 0 - popularity / 1_000_000;
  if (title.startsWith(search)) return 100 + title.length - search.length - popularity / 1_000_000;
  if (title.includes(search)) return 300 + title.indexOf(search) + title.length / 100 - popularity / 1_000_000;

  const searchWords = search.split(' ').filter(Boolean);
  const titleWords = title.split(' ').filter(Boolean);
  const matchingWords = searchWords.filter((word) => titleWords.some((titleWord) => titleWord.startsWith(word))).length;

  if (matchingWords > 0) {
    return 600 + (searchWords.length - matchingWords) * 50 + title.length / 100 - popularity / 1_000_000;
  }

  return 1_000 + index - popularity / 1_000_000;
};

const rankSearchResults = (results: Media[], query: string) =>
  results
    .map((media, index) => ({ media, rank: getSearchRank(media, query, index), index }))
    .sort((a, b) => a.rank - b.rank || b.media.popularity - a.media.popularity || a.index - b.index)
    .map((item) => item.media);

export const SearchSheet = () => {
  const isOnline = useOnlineStatus();
  const {
    isSearchFocused,
    closeAllSheets,
    apiKey,
    isLoaded,
    watchlist,
    watched,
  } = useAppContext();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Media[]>([]);
  const [trending, setTrending] = useState<Media[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSubmittedSearch, setHasSubmittedSearch] = useState(false);
  const searchAbortController = useRef<AbortController | null>(null);

  const searchTerm = query.trim();
  const isLibraryEmpty = watchlist.length === 0 && watched.length === 0;
  const trendingLoading = isOnline && isSearchFocused && !!apiKey && isLoaded && trending.length === 0 && !hasSubmittedSearch;
  const displayError = isSearchFocused
    ? isOnline ? error : 'Search is unavailable offline. Your saved collection remains available.'
    : null;

  const runSearch = useCallback(async (value: string) => {
    if (!isOnline) {
      setError('Search is unavailable offline.');
      return;
    }

    if (value.trim().length < 2) {
      return;
    }

    if (searchAbortController.current) searchAbortController.current.abort();
    searchAbortController.current = new AbortController();

    try {
      setError(null);
      setIsSearching(true);
      setHasSubmittedSearch(true);
      const signal = searchAbortController.current.signal;
      const [tmdbResult, gameResult] = await Promise.allSettled([
        apiKey ? searchMedia(value, apiKey, signal) : Promise.resolve([] as Media[]),
        hasGameApi() ? searchIgdbGames(value, signal) : Promise.resolve([] as Media[]),
      ]);

      if (signal.aborted) return;

      const tmdbResults = tmdbResult.status === 'fulfilled' ? tmdbResult.value : [];
      const gameResults = gameResult.status === 'fulfilled' ? gameResult.value : [];
      setSearchResults(rankSearchResults([...tmdbResults, ...gameResults], value));

      if (tmdbResult.status === 'rejected') {
        console.error('TMDB search error:', tmdbResult.reason);
      }

      if (gameResult.status === 'rejected') {
        console.error('Game search error:', gameResult.reason);
        if (tmdbResults.length === 0) {
          setError(gameResult.reason instanceof Error ? gameResult.reason.message : 'Game search failed');
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsSearching(false);
    }
  }, [apiKey, isOnline]);

  useEffect(() => {
    if (!isOnline || !isSearchFocused) return;
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
  }, [apiKey, isLoaded, isOnline, isSearchFocused, trending.length]);

  useEffect(() => {
    return () => {
      if (searchAbortController.current) searchAbortController.current.abort();
    };
  }, []);

  const closeSheet = () => {
    if (isLibraryEmpty) return;
    closeAllSheets();
  };
  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (searchTerm.length < 2 || isSearching) return;
    void runSearch(searchTerm);
  };
  const displayedMedia = useMemo(() => {
    if (hasSubmittedSearch) return searchResults;
    return trending;
  }, [hasSubmittedSearch, searchResults, trending]);
  const searchControls = (
    <form className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3" onSubmit={handleSearchSubmit}>
      <img
        src={logoPng.src}
        alt="Void"
        className="h-10 w-10 rounded-xl object-cover blueprint-border bg-brand-bg shrink-0"
        decoding="async"
      />
      <div className="relative min-w-0 flex-1">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-cyan" size={16} />
        <input
          type="text"
          value={query}
          autoFocus
          disabled={!isOnline}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          placeholder={isOnline ? 'Search movies, shows, games...' : 'Search unavailable offline'}
          className="w-full rounded-xl border border-brand-cyan/20 bg-brand-bg/90 py-2.5 pl-10 pr-11 text-sm font-medium text-white outline-none shadow-[0_0_20px_rgba(34,211,238,0.08)] ring-2 ring-brand-cyan/10 placeholder:text-brand-silver/50"
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setSearchResults([]);
              setHasSubmittedSearch(false);
              setError(null);
              if (searchAbortController.current) searchAbortController.current.abort();
            }}
            className="p-2 text-brand-silver transition-colors hover:text-white"
            title="Clear search"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <button
        type="submit"
        disabled={!isOnline || searchTerm.length < 2 || isSearching}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan shadow-[0_0_15px_rgba(34,211,238,0.1)] transition-all hover:border-brand-cyan/40 hover:bg-brand-cyan/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
        title="Search"
        aria-label="Search"
      >
        {isSearching ? <LoaderCircle size={16} className="animate-spin" /> : <ArrowRight size={17} />}
      </button>
    </form>
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
            ? "relative w-full h-full bg-brand-bg/95 shadow-2xl overflow-hidden flex flex-col will-change-transform"
            : "relative w-full max-w-6xl h-[92vh] max-h-[96vh] bg-brand-bg/95 blueprint-border rounded-t-3xl shadow-2xl overflow-hidden flex flex-col will-change-transform"
          }
        >
          <FocusTrap active={isSearchFocused}>
          <div className={topBarClassName}>
            <div className={searchWrapperClassName}>
              {searchControls}
            </div>
            {!isLibraryEmpty && (
              <button
                onClick={closeSheet}
                className="shrink-0 rounded-lg border border-brand-cyan/25 bg-brand-cyan/10 p-3 text-brand-cyan shadow-[0_0_15px_rgba(34,211,238,0.1)] transition-all hover:border-brand-cyan/40 hover:bg-brand-cyan/20 hover:text-white"
                title="Close search"
              >
                <X size={20} />
              </button>
            )}
          </div>

          {isLibraryEmpty && (
            <p className="px-4 pb-2 pt-4 text-center text-xs uppercase tracking-[0.2em] text-brand-silver/60">
              Search and add titles to your collection
            </p>
          )}

          <div className="px-4 pb-24 overflow-y-auto flex-1">

            {displayError && (
              <p className="text-sm text-red-400 mb-4">{displayError}</p>
            )}

            {isSearching ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="aspect-[2/3] rounded-xl bg-white/10 animate-pulse" />
                ))}
              </div>
            ) : trendingLoading && !hasSubmittedSearch ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="aspect-[2/3] rounded-xl bg-white/10 animate-pulse" />
                ))}
              </div>
            ) : displayedMedia.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {displayedMedia.map((item) => (
                  <MediaCard
                    key={getMediaKey(item)}
                    media={item}
                    showReleaseBadge={false}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-brand-silver text-center py-16">
                {hasSubmittedSearch ? 'Try a different search term.' : 'No titles to show.'}
              </p>
            )}

            {isLibraryEmpty && (
              <div className="pt-10 pb-4 text-center text-xs uppercase tracking-[0.2em] text-brand-silver/60">
                Data provided by TMDB and IGDB.
              </div>
            )}
          </div>

          {!isLibraryEmpty && <SheetDragHandle onClose={closeSheet} />}
          </FocusTrap>
        </motion.div>

      </div>
    </AnimatePresence>
  );
};
