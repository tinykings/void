'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppContext } from '@/context/AppContext';
import { SearchResults } from '@/components/SearchResults';
import { ArrowRight, LoaderCircle, Search as SearchIcon, X } from 'lucide-react';
import { SheetDragHandle } from '@/components/SheetDragHandle';
import { FocusTrap } from '@/components/FocusTrap';
import logoPng from '../../public/logo.png';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useMediaSearch } from '@/hooks/useMediaSearch';

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
  const isLibraryEmpty = watchlist.length === 0 && watched.length === 0;
  const displayError = isSearchFocused
    ? isOnline ? error : 'Search is unavailable offline. Your saved collection remains available.'
    : null;

  const closeSheet = () => {
    if (isLibraryEmpty) return;
    closeAllSheets();
  };
  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (searchTerm.length < 2 || isSearching) return;
    void runSearch(searchTerm);
  };
  const searchControls = (
    <form className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3" onSubmit={handleSearchSubmit}>
      <img
        src={logoPng.src}
        alt="Void"
        className="h-10 w-10 rounded-lg object-cover blueprint-border bg-brand-bg shrink-0"
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
          className="w-full rounded-lg border border-white/10 bg-brand-bg/90 py-2.5 pl-10 pr-11 text-sm font-medium text-white outline-none ring-1 ring-transparent placeholder:text-brand-silver/50 focus:border-brand-cyan/25 focus:ring-brand-cyan/30"
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setQuery('');
              clearSearch();
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
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-brand-cyan/10 text-brand-cyan transition-colors hover:border-brand-cyan/40 hover:bg-brand-cyan/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
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
      <div className="fixed inset-0 z-[340] flex items-end justify-center" onClick={closeSheet}>
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
          className="sheet-surface will-change-transform"
        >
          <FocusTrap active={isSearchFocused}>
          <div className={topBarClassName}>
            <div className={searchWrapperClassName}>
              {searchControls}
            </div>
            {!isLibraryEmpty && (
              <button
                onClick={closeSheet}
                className="shrink-0 rounded-lg border border-white/10 p-3 text-brand-silver transition-colors hover:border-brand-cyan/25 hover:bg-brand-cyan/10 hover:text-white"
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

            <SearchResults
              hasSubmittedSearch={hasSubmittedSearch}
              isLoading={isSearching || (trendingLoading && !hasSubmittedSearch)}
              media={displayedMedia}
            />

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
