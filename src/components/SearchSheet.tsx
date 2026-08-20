'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppContext } from '@/context/AppContext';
import { SearchResults } from '@/components/SearchResults';
import { ArrowLeft, ArrowRight, LoaderCircle, Search as SearchIcon, X } from 'lucide-react';
import { SheetDragHandle } from '@/components/SheetDragHandle';
import { FocusTrap } from '@/components/FocusTrap';
import logoPng from '../../public/logo.png';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useMediaSearch } from '@/hooks/useMediaSearch';
import { backOrHome, rememberScrollPosition, restoreScrollPosition } from '@/lib/clientNavigation';
import type { MediaType } from '@/lib/types';

export const SearchSheet = () => {
  const isOnline = useOnlineStatus();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPageMode = pathname.replace(/\/$/, '').endsWith('/search');
  const initialQuery = isPageMode ? searchParams.get('q') || '' : '';
  const lastSearchRef = useRef('');
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const {
    isSearchFocused,
    activeDetailsMedia,
    activeActorMedia,
    closeAllSheets,
    apiKey,
    isLoaded,
    watchlist,
    watched,
    enabledMediaTypes,
  } = useAppContext();
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);
  const [mediaFilter, setMediaFilter] = useState<'all' | MediaType>('all');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const {
    clearSearch,
    displayedMedia,
    error,
    hasSubmittedSearch,
    isSearching,
    runSearch,
    trendingLoading,
  } = useMediaSearch({ apiKey, enabled: isSearchFocused, isLoaded, isOnline });

  const searchTerm = query.trim();
  const availableFilters = useMemo(() => (['movie', 'tv', 'game'] as const).filter((type) => enabledMediaTypes[type]), [enabledMediaTypes]);
  const activeMediaFilter = mediaFilter === 'all' || enabledMediaTypes[mediaFilter] ? mediaFilter : 'all';
  const filteredMedia = useMemo(() => {
    const visibleMedia = displayedMedia.filter((item) => enabledMediaTypes[item.media_type]);
    return activeMediaFilter === 'all' ? visibleMedia : visibleMedia.filter((item) => item.media_type === activeMediaFilter);
  }, [activeMediaFilter, displayedMedia, enabledMediaTypes]);
  const isLibraryEmpty = watchlist.length === 0 && watched.length === 0;
  const displayError = isSearchFocused
    ? isOnline ? error : 'Search is unavailable offline. Your saved collection remains available.'
    : null;

  const closeSheet = () => {
    if (isPageMode) {
      closeAllSheets();
      backOrHome(router, '/search');
      return;
    }
    if (isLibraryEmpty) return;
    closeAllSheets();
  };
  const submitSearch = (value: string) => {
    if (value.length < 2 || isSearching) return;
    setSubmittedQuery(value);
    const recent = [value, ...recentSearches.filter((item) => item.toLowerCase() !== value.toLowerCase())].slice(0, 5);
    setRecentSearches(recent);
    localStorage.setItem('void_recent_searches', JSON.stringify(recent));

    if (isPageMode) {
      if (initialQuery === value) {
        lastSearchRef.current = value;
        void runSearch(value);
      } else {
        router.replace(`/search?q=${encodeURIComponent(value)}`, { scroll: false });
      }
      return;
    }
    void runSearch(value);
  };
  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitSearch(searchTerm);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setRecentSearches(JSON.parse(localStorage.getItem('void_recent_searches') || '[]'));
      } catch {
        setRecentSearches([]);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isPageMode) return;
    const timer = window.setTimeout(() => {
      setQuery(initialQuery);
      const value = initialQuery.trim();
      if (value.length < 2) {
        lastSearchRef.current = '';
        setSubmittedQuery('');
        setMediaFilter('all');
        clearSearch();
        return;
      }
      if (lastSearchRef.current === value) return;
      lastSearchRef.current = value;
      setSubmittedQuery(value);
      void runSearch(value);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [clearSearch, initialQuery, isPageMode, runSearch]);

  useEffect(() => {
    if (!isPageMode || isSearching || trendingLoading) return;
    const savedScroll = restoreScrollPosition(`${location.pathname}${location.search}`);
    if (savedScroll !== null) requestAnimationFrame(() => resultsRef.current?.scrollTo({ top: savedScroll }));
  }, [isPageMode, isSearching, trendingLoading]);

  useEffect(() => {
    if (isPageMode || !window.matchMedia('(min-width: 768px)').matches) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 160);
    return () => window.clearTimeout(timer);
  }, [isPageMode]);
  const searchControls = (
    <form className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3" onSubmit={handleSearchSubmit}>
      <img
        src={logoPng.src}
        alt="Void"
        className="hidden h-10 w-10 shrink-0 rounded-lg bg-brand-bg object-cover blueprint-border sm:block"
        decoding="async"
      />
      <div className="relative min-w-0 flex-1">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-cyan" size={16} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          disabled={!isOnline}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          placeholder={isOnline ? 'Search movies, shows, games...' : 'Search unavailable offline'}
          className="h-11 w-full rounded-lg border border-white/10 bg-brand-bg/90 py-2.5 pl-10 pr-12 text-base font-medium text-white outline-none ring-1 ring-transparent placeholder:text-brand-silver/50 focus:border-brand-cyan/25 focus:ring-brand-cyan/30 sm:text-sm"
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setSubmittedQuery('');
              setMediaFilter('all');
              clearSearch();
              if (isPageMode) router.replace('/search', { scroll: false });
            }}
            className={`${query ? 'flex' : 'hidden'} h-11 w-11 items-center justify-center text-brand-silver transition-colors hover:text-white`}
            title="Clear search"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <button
        type="submit"
        disabled={!isOnline || searchTerm.length < 2 || isSearching}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-brand-cyan/10 text-brand-cyan transition-colors hover:border-brand-cyan/40 hover:bg-brand-cyan/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
        title="Search"
        aria-label="Search"
      >
        {isSearching ? <LoaderCircle size={16} className="animate-spin" /> : <ArrowRight size={17} />}
      </button>
    </form>
  );
  const topBarClassName = isLibraryEmpty && !isPageMode
    ? 'flex items-center justify-center gap-2 border-b border-white/5 bg-brand-bg/80 px-3 py-3 sm:px-4'
    : 'flex items-center gap-2 border-b border-white/5 bg-brand-bg/80 px-3 py-3 sm:px-4';
  const searchWrapperClassName = isLibraryEmpty && !isPageMode ? 'flex w-full max-w-2xl items-center' : 'flex w-full items-center';

  if (!isSearchFocused) return null;

  return (
    <AnimatePresence>
      <div
        className={`fixed inset-0 z-[340] flex justify-center ${isPageMode ? 'items-stretch' : 'items-end'}`}
        onClick={closeSheet}
        inert={Boolean(activeDetailsMedia || activeActorMedia)}
        aria-hidden={activeDetailsMedia || activeActorMedia ? 'true' : undefined}
      >
        {!isPageMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
        )}

        <motion.div
          initial={isPageMode ? false : { y: '100%' }}
          animate={{ y: 0 }}
          exit={isPageMode ? undefined : { y: '100%' }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className={`${isPageMode ? 'page-surface' : 'sheet-surface search-surface'} will-change-transform`}
          role={isPageMode ? undefined : 'dialog'}
          aria-label="Search"
          aria-modal={isPageMode ? undefined : 'true'}
        >
          <FocusTrap active={isSearchFocused && !isPageMode} autoFocus={false}>
          <div className={topBarClassName}>
            <div className={searchWrapperClassName}>
              {searchControls}
            </div>
            {(!isLibraryEmpty || isPageMode) && (
              <button
                onClick={closeSheet}
                className="order-first shrink-0 rounded-lg border border-white/10 p-3 text-brand-silver transition-colors hover:border-brand-cyan/25 hover:bg-brand-cyan/10 hover:text-white sm:order-last"
                title={isPageMode ? 'Back to collection' : 'Close search'}
                aria-label={isPageMode ? 'Back to collection' : 'Close search'}
              >
                {isPageMode ? <ArrowLeft size={20} /> : <X size={20} />}
              </button>
            )}
          </div>

          {isLibraryEmpty && !isPageMode && (
            <p className="type-body px-4 pb-2 pt-4 text-center text-brand-silver/60">
              Search and add titles to your collection
            </p>
          )}

          <div
            ref={resultsRef}
            data-route-scroll
            className="flex-1 overflow-y-auto px-4 pb-[calc(6rem+env(safe-area-inset-bottom,0px))]"
            onScroll={(event) => {
              if (isPageMode) rememberScrollPosition(`${location.pathname}${location.search}`, event.currentTarget.scrollTop);
            }}
          >

            {displayError && (
              <p className="text-sm text-red-400 mb-4">{displayError}</p>
            )}

            {!hasSubmittedSearch && recentSearches.length > 0 && (
              <section className="mb-5 pt-4" aria-labelledby="recent-searches-heading">
                <h2 id="recent-searches-heading" className="type-label mb-2 text-brand-silver">Recent searches</h2>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((item) => (
                    <button key={item} type="button" onClick={() => { setQuery(item); submitSearch(item); }} className="min-h-11 rounded-lg border border-white/10 px-3 text-sm text-brand-silver hover:border-brand-cyan/30 hover:text-white">
                      {item}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <div className="mb-3 flex items-center justify-between gap-3 pt-4">
              <h2 className="type-label text-brand-silver">
                {hasSubmittedSearch ? `Results for “${submittedQuery}”` : 'Trending now'}
              </h2>
              {!isSearching && <span className="type-readout text-brand-silver/70">{filteredMedia.length}</span>}
            </div>

            {hasSubmittedSearch && (
              <div className="mb-4 flex gap-2 overflow-x-auto" aria-label="Filter search results">
                {(['all', ...availableFilters] as Array<'all' | MediaType>).map((filter) => (
                  <button key={filter} type="button" onClick={() => setMediaFilter(filter)} className={`type-action min-h-11 shrink-0 rounded-lg border px-3 ${activeMediaFilter === filter ? 'border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan' : 'border-white/10 text-brand-silver'}`}>
                    {filter === 'all' ? 'All' : filter === 'tv' ? 'Shows' : `${filter[0].toUpperCase()}${filter.slice(1)}s`}
                  </button>
                ))}
              </div>
            )}

            <SearchResults
              hasSubmittedSearch={hasSubmittedSearch}
              isLoading={isSearching || (trendingLoading && !hasSubmittedSearch)}
              media={filteredMedia}
              query={submittedQuery}
            />

            {isLibraryEmpty && (
              <div className="type-readout pt-10 pb-4 text-center text-brand-silver/60">
                Data provided by TMDB and IGDB.
              </div>
            )}
          </div>

          {!isLibraryEmpty && !isPageMode && <SheetDragHandle onClose={closeSheet} />}
          </FocusTrap>
        </motion.div>

      </div>
    </AnimatePresence>
  );
};
