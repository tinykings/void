'use client';

import { useEffect, useState, useMemo, useTransition, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppContext } from '@/context/AppContext';
import { ActorSheet } from '@/components/ActorSheet';
import { MediaCard } from '@/components/MediaCard';
import { MediaCardSkeleton } from '@/components/MediaCardSkeleton';
import { DetailsSheet } from '@/components/DetailsSheet';
import { SearchSheet } from '@/components/SearchSheet';
import { sortMedia, sortByAddedDate } from '@/lib/sort';

import { AlertCircle, Bookmark, Film, Gamepad2, Github, Heart, History, LayoutGrid, LoaderCircle, LogOut, Radio, Search, Settings, SlidersHorizontal, Tv, X } from 'lucide-react';
import type { FilterType } from '@/lib/types';
import { getMediaKey } from '@/lib/media';
import { clsx } from 'clsx';
import { SheetDragHandle } from '@/components/SheetDragHandle';
import { FocusTrap } from '@/components/FocusTrap';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useStreamProviders } from '@/hooks/useStreamProviders';
import type { StreamableMedia } from '@/lib/streamProviders';
import { HomeStreamSection } from '@/components/HomeStreamSection';

type LibraryMode = 'library' | 'watchlist';

export const HomeView = () => {
  const isOnline = useOnlineStatus();
  const {
    isLoaded, 
    apiKey,
    watchlist, 
    watched,
    filter,
    setFilter,
    sort,
    showWatched,
    setShowWatched,
    showFavoritesOnly,
    setShowFavoritesOnly,
    githubLogin,
    disconnectGithub,
    syncFromGist,
    isSyncingLibrary,
    isSearchFocused,
    setIsSearchFocused,
    closeAllSheets,
    openDetails,
  } = useAppContext();
  
  const [isPending, startTransition] = useTransition();

  // Status label (sort/filter feedback)
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [statusFading, setStatusFading] = useState(false);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeFilter = filter || 'all';
  const activeLibraryMode: LibraryMode = showWatched ? 'library' : 'watchlist';
  const streamablePlaylist = useMemo(() => watchlist.filter((item): item is StreamableMedia => item.media_type === 'movie' || item.media_type === 'tv'), [watchlist]);
  const [showStreamView, setShowStreamView] = useState(false);
  const {
    failureCount: streamFailureCount,
    groups: streamGroups,
    isLoading: isStreamLoading,
  } = useStreamProviders({ apiKey, enabled: showStreamView, isOnline, playlist: streamablePlaylist });
  const activeModeLabel = showStreamView ? 'Stream' : showFavoritesOnly ? 'Favorites' : activeLibraryMode === 'library' ? 'History' : 'Playlist';
  const activeFilterLabel = activeFilter === 'all' ? 'All' : activeFilter === 'movie' ? 'Movies' : activeFilter === 'tv' ? 'Shows' : 'Games';

  const persistentStatus = useMemo(() => {
    if (showStreamView) return 'Stream · Playlist';
    return `${activeModeLabel} · ${activeFilterLabel}`;
  }, [activeFilterLabel, activeModeLabel, showStreamView]);

  const showStatus = useCallback((label: string) => {
    // If it matches a persistent state, we don't need a timer
    if (label === persistentStatus) {
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      setStatusLabel(null);
      setStatusFading(false);
      return;
    }

    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    setStatusLabel(label);
    setStatusFading(false);
    statusTimerRef.current = setTimeout(() => {
      setStatusFading(true);
      statusTimerRef.current = setTimeout(() => {
        setStatusLabel(null);
        setStatusFading(false);
      }, 400);
    }, 1600);
  }, [persistentStatus]);

  const [error] = useState<string | null>(null);

  // Footer popover state
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  
  // Pagination for library
  const [visibleItemsCount, setVisibleItemsCount] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedCount = sessionStorage.getItem('void_home_count');
      if (savedCount) return parseInt(savedCount, 10);
    }
    return 24;
  });
  const itemsPerPage = 24;
  const observer = useRef<IntersectionObserver | null>(null);

  // Combine and process library media
  const baseLibraryMedia = useMemo(() => {
    const combined = showWatched ? watched : watchlist;
    if (activeFilter === 'all') return combined;
    return combined.filter(m => m.media_type === activeFilter);
  }, [watchlist, watched, activeFilter, showWatched]);

  const libraryMedia = useMemo(() => {
    let filtered = [...baseLibraryMedia];
    
    if (showFavoritesOnly) {
      filtered = filtered.filter(m => m.isFavorite);
    }

    return showWatched ? sortByAddedDate(filtered) : sortMedia(filtered);
  }, [baseLibraryMedia, showFavoritesOnly, showWatched]);

  const emptyTitle = (() => {
    if (showStreamView) {
      if (!isOnline) return 'Streaming availability is offline';
      return streamablePlaylist.length === 0 ? 'Your playlist has no streamable titles' : 'No streaming providers found';
    }
    if (showFavoritesOnly) return 'No favorites yet';
    if (activeLibraryMode === 'library') return 'Your history is empty';
    return 'Your playlist is empty';
  })();
  const emptyDescription = (() => {
    if (showStreamView) {
      if (!isOnline) return 'Reconnect to refresh provider information. Your playlist remains available.';
      if (streamablePlaylist.length === 0) return 'Add movies or shows to your playlist to see streaming options.';
      return 'No US free or subscription providers were found for your playlist.';
    }

    if (activeFilter !== 'all') {
      return `No ${activeFilterLabel.toLowerCase()} found in ${activeModeLabel.toLowerCase()}.`;
    }

    if (showFavoritesOnly) return 'Mark history items as favorites to see them here.';
    if (activeLibraryMode === 'library') return 'Move movies, shows, and games to history after finishing them.';
    return 'Search for movies, shows, and games to add them to your playlist.';
  })();

  const selectTypeFilter = (nextFilter: FilterType) => {
    startTransition(() => {
      setShowStreamView(false);
      setFilter(nextFilter);
    });

    showStatus(nextFilter === 'all' ? 'All' : nextFilter === 'movie' ? 'Movies' : nextFilter === 'tv' ? 'Shows' : 'Games');
    setShowTypeMenu(false);
    window.scrollTo(0, 0);
  };

  const selectFavoritesFilter = () => {
    startTransition(() => {
      setShowStreamView(false);
      setShowWatched(true);
      setShowFavoritesOnly(!showFavoritesOnly);
      setIsSearchFocused(false);
    });

    showStatus(showFavoritesOnly ? 'Favorites Off' : 'Favorites');
    setShowTypeMenu(false);
    window.scrollTo(0, 0);
  };

  const selectStreamView = () => {
    startTransition(() => {
      setShowStreamView(true);
      setShowWatched(false);
      setShowFavoritesOnly(false);
      setIsSearchFocused(false);
    });

    showStatus('Stream');
    setShowTypeMenu(false);
    window.scrollTo(0, 0);
  };

  const selectLibraryMode = (mode: LibraryMode) => {
    startTransition(() => {
      setShowStreamView(false);
      setShowWatched(mode !== 'watchlist');
      setShowFavoritesOnly(false);
      setIsSearchFocused(false);
    });

    showStatus(mode === 'library' ? 'History' : 'Playlist');
    setShowTypeMenu(false);
    window.scrollTo(0, 0);
  };

  const clearActiveFilterView = () => {
    startTransition(() => {
      setShowStreamView(false);
      setShowFavoritesOnly(false);
      setIsSearchFocused(false);
    });

    showStatus(activeLibraryMode === 'library' ? 'History' : 'Playlist');
    setShowTypeMenu(false);
    window.scrollTo(0, 0);
  };
    
  const displayMedia = useMemo(() => libraryMedia.slice(0, visibleItemsCount), [libraryMedia, visibleItemsCount]);

  const isLoading = isPending;

  // Stable callback for loading more items
  const handleIntersection = useCallback(() => {
    setVisibleItemsCount(prev => prev + itemsPerPage);
  }, []);

  // Create observer once with stable callback
  useEffect(() => {
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        handleIntersection();
      }
    }, { rootMargin: '200px' });

    return () => {
      observer.current?.disconnect();
    };
  }, [handleIntersection]);

  // Attach/detach observer based on last item
  const lastItemRef = useCallback((node: HTMLDivElement | null) => {
    if (observer.current) {
      observer.current.disconnect();
    }
    if (node) {
      observer.current?.observe(node);
    }
  }, []);

  // Flag to prevent resets on initial mount (important for restoration)
  const isInitialMount = useRef(true);

  // Restore scroll position when returning from details page
  useEffect(() => {
    const savedScroll = sessionStorage.getItem('void_home_scroll');
    if (savedScroll) {
      const targetScroll = parseInt(savedScroll, 10);
      let attempts = 0;
      const maxAttempts = 15;

      const tryScroll = () => {
        attempts++;
        window.scrollTo(0, targetScroll);
        
        const currentScroll = window.scrollY;
        if (Math.abs(currentScroll - targetScroll) > 10 && attempts < maxAttempts) {
          // If the page is still too short to reach the target, we keep trying
          setTimeout(tryScroll, 100);
        }
      };

      const timeoutId = setTimeout(tryScroll, 100);
      return () => clearTimeout(timeoutId);
    }
  }, []);

  // Clear session storage only after we are sure we don't need it for a remount
  useEffect(() => {
    const savedScroll = sessionStorage.getItem('void_home_scroll');
    if (savedScroll) {
      const timeoutId = setTimeout(() => {
        sessionStorage.removeItem('void_home_scroll');
        sessionStorage.removeItem('void_home_count');
      }, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    if (isInitialMount.current) return;
    setVisibleItemsCount(itemsPerPage);
    
    // Clear saved state if user manually changes view
    sessionStorage.removeItem('void_home_scroll');
    sessionStorage.removeItem('void_home_count');
  }, [filter, sort, showWatched, showFavoritesOnly]);

  // Reset favorites filter when leaving watched view
  useEffect(() => {
    if (isInitialMount.current) return;
    if (!showWatched) {
      setShowFavoritesOnly(false);
    }
  }, [showWatched, setShowFavoritesOnly]);

  // Toggle mount flag last
  useEffect(() => {
    isInitialMount.current = false;
  }, []);

  // Cleanup and browser settings
  useEffect(() => {
    // Disable browser scroll restoration to prevent it from jumping before our logic
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }

    // Set default theme color for Home
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#030712'); // gray-950

    return () => {
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, []);

  if (!isLoaded) return null;
  return (
    <div className="max-w-7xl mx-auto px-2 pt-4 pb-[160px] relative">

      {error && (
        <div className="bg-red-900/20 text-red-400 p-4 rounded-xl flex items-start gap-3 mb-6 border border-red-900/30">
          <AlertCircle size={20} className="mt-0.5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {isLoading && !showStreamView ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {[...Array(12)].map((_, i) => (
            <MediaCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          {showStreamView ? (
            <HomeStreamSection
              emptyDescription={emptyDescription}
              emptyTitle={emptyTitle}
              failureCount={streamFailureCount}
              groups={streamGroups}
              isLoading={isStreamLoading}
              onSelect={openDetails}
              playlistCount={streamablePlaylist.length}
            />
          ) : displayMedia.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
              {displayMedia.map((item, index) => (
                <div
                  key={getMediaKey(item)}
                  ref={(node) => lastItemRef(index === displayMedia.length - 1 ? node : null)}
                >
                  <MediaCard
                    media={item}
                    showReleaseBadge={!showWatched}
                    onClick={() => {
                      sessionStorage.setItem('void_home_count', String(visibleItemsCount));
                    }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-brand-silver">
              <div className="flex flex-col items-center gap-4">
                <p className="text-lg font-medium text-white">
                  {emptyTitle}
                </p>
                <p className="text-sm text-brand-silver max-w-xs mx-auto">
                  {emptyDescription}
                </p>
              </div>
            </div>
          )}

        </>
      )}

      <DetailsSheet />
      <ActorSheet />
      <SearchSheet />

      <AnimatePresence>
        {isSyncingLibrary && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="fixed inset-0 z-[360] flex items-center justify-center pointer-events-none px-4"
            aria-live="polite"
          >
            <div className="flex flex-col items-center gap-3 rounded-xl bg-brand-bg/90 px-5 py-4 text-center backdrop-blur-md embossed-edge">
              <LoaderCircle size={22} className="animate-spin text-brand-cyan" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">Syncing collection</p>
                <p className="text-[11px] uppercase tracking-[0.18em] text-brand-silver/60">
                  Updating from your Gist
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fixed Bottom Bar */}
      {!isSearchFocused && (
        <div className="fixed bottom-0 left-0 right-0 z-30 pb-3 px-3 pointer-events-none">
          <div
            aria-live="polite"
            className={clsx(
              'absolute left-1/2 -translate-x-1/2 bottom-full mb-3 px-4 py-1.5 rounded-full bg-brand-bg/80 backdrop-blur-md border border-brand-cyan/20 text-xs font-semibold tracking-widest uppercase text-brand-cyan whitespace-nowrap transition-all duration-300 pointer-events-none',
              (persistentStatus || (statusLabel && !statusFading))
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-3'
            )}
          >
            {statusLabel && !statusFading ? statusLabel : persistentStatus}
          </div>

            <nav aria-label="Main navigation" className="max-w-sm mx-auto relative pointer-events-auto">
            <div className="grid grid-cols-[56px_1fr_auto] items-center gap-2 rounded-[28px] bg-brand-bg/70 backdrop-blur-xl blueprint-border p-2 shadow-2xl shadow-black/35">
              <div className="relative">
                {showTypeMenu && (
                  <div className="absolute bottom-full left-0 mb-3 w-44 rounded-xl bg-brand-bg blueprint-border overflow-hidden">
                    {[
                      { id: 'all' as const, label: 'All', icon: LayoutGrid },
                      { id: 'movie' as const, label: 'Movies', icon: Film },
                      { id: 'tv' as const, label: 'Shows', icon: Tv },
                      { id: 'game' as const, label: 'Games', icon: Gamepad2 },
                    ].map((item) => {
                      const Icon = item.icon;
                      const isActive = !showStreamView && activeFilter === item.id;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => selectTypeFilter(item.id)}
                          className={clsx(
                            'w-full px-3 py-3 text-left text-sm font-bold flex items-center gap-2 transition-colors',
                            isActive
                              ? 'text-brand-cyan bg-brand-cyan/5'
                              : 'text-brand-silver hover:text-white hover:bg-brand-bg/50'
                          )}
                        >
                          <Icon size={15} />
                          {item.label}
                        </button>
                      );
                    })}

                    <div className="h-px bg-white/5" />

                    <button
                      type="button"
                      onClick={selectFavoritesFilter}
                      className={clsx(
                        'w-full px-3 py-3 text-left text-sm font-bold flex items-center gap-2 transition-colors',
                        showFavoritesOnly
                          ? 'bg-brand-cyan/12 text-brand-cyan'
                          : 'text-brand-silver hover:bg-brand-bg/50 hover:text-white'
                      )}
                    >
                      <Heart size={15} className={showFavoritesOnly ? 'fill-current' : undefined} />
                      Favorites
                    </button>

                    <div className="h-px bg-white/5" />

                    <button
                      type="button"
                      onClick={selectStreamView}
                      className={clsx(
                        'w-full px-3 py-3 text-left text-sm font-bold flex items-center gap-2 transition-colors',
                        showStreamView
                          ? 'text-brand-cyan bg-brand-cyan/5'
                          : 'text-brand-silver hover:text-white hover:bg-brand-bg/50'
                      )}
                    >
                      <Radio size={15} />
                      Stream
                    </button>

                    <div className="h-px bg-white/5" />

                    <button
                      type="button"
                      onClick={() => {
                        setShowTypeMenu(false);
                        setShowSyncModal(true);
                      }}
                      className="w-full px-3 py-3 text-left text-sm font-bold flex items-center gap-2 text-brand-silver hover:text-white hover:bg-brand-bg/50 transition-colors"
                    >
                      <Settings size={15} />
                      Settings
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (showStreamView || showFavoritesOnly) {
                      clearActiveFilterView();
                      return;
                    }

                    setShowTypeMenu((current) => !current);
                  }}
                  className={clsx(
                    'flex h-12 w-12 items-center justify-center rounded-lg transition-all',
                    showStreamView || showFavoritesOnly || showTypeMenu || activeFilter !== 'all'
                      ? 'bg-brand-cyan/12 text-brand-cyan shadow-[0_0_18px_rgba(34,211,238,0.16)] hover:bg-brand-cyan/20 hover:text-white'
                      : 'text-brand-silver hover:bg-brand-cyan/10 hover:text-white'
                  )}
                  aria-label={showStreamView ? 'Clear Stream view' : showFavoritesOnly ? 'Clear Favorites view' : `Filter: ${activeFilterLabel}`}
                  aria-haspopup={showStreamView || showFavoritesOnly ? undefined : 'menu'}
                  aria-expanded={showStreamView || showFavoritesOnly ? undefined : showTypeMenu}
                  title={showStreamView ? 'Clear Stream view' : showFavoritesOnly ? 'Clear Favorites view' : `Filter: ${activeFilterLabel}`}
                >
                  {showStreamView ? (
                    <Radio size={19} />
                  ) : showFavoritesOnly ? (
                    <Heart size={19} className="fill-current" />
                  ) : activeFilter === 'movie' ? (
                    <Film size={19} />
                  ) : activeFilter === 'tv' ? (
                    <Tv size={19} />
                  ) : activeFilter === 'game' ? (
                    <Gamepad2 size={19} />
                  ) : (
                    <SlidersHorizontal size={19} />
                  )}
                </button>
              </div>

              <div className="relative grid grid-cols-2 rounded-full bg-black/20 p-1 ring-1 ring-white/[0.06]">
                <div
                  className={clsx(
                    'absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-brand-cyan/15 shadow-[0_0_22px_rgba(34,211,238,0.14)] transition-transform duration-300 ease-out',
                    activeLibraryMode === 'watchlist' && !showFavoritesOnly && !showStreamView ? 'translate-x-full' : 'translate-x-0'
                  )}
                />

                <button
                  type="button"
                  onClick={() => selectLibraryMode('library')}
                  className={clsx(
                    'relative z-10 flex h-10 items-center justify-center rounded-full transition-colors',
                    activeLibraryMode === 'library' && !showFavoritesOnly && !showStreamView ? 'text-brand-cyan' : 'text-brand-silver hover:text-white'
                  )}
                  aria-label="History"
                  title="History"
                >
                  <History size={18} />
                </button>

                <button
                  type="button"
                  onClick={() => selectLibraryMode('watchlist')}
                  className={clsx(
                    'relative z-10 flex h-10 items-center justify-center rounded-full transition-colors',
                    activeLibraryMode === 'watchlist' && !showFavoritesOnly && !showStreamView ? 'text-brand-cyan' : 'text-brand-silver hover:text-white'
                  )}
                  aria-label="Playlist"
                  title="Playlist"
                >
                  <Bookmark size={18} />
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  startTransition(() => {
                    setShowStreamView(false);
                    setIsSearchFocused(true);
                  });
                  setShowTypeMenu(false);
                }}
                className="flex h-12 w-12 items-center justify-center rounded-lg text-brand-silver hover:bg-brand-cyan/10 hover:text-white transition-all"
                aria-label="Search"
                title="Search"
              >
                <Search size={19} />
              </button>
            </div>
          </nav>
        </div>
      )}

      <AnimatePresence>
        {showSyncModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => { closeAllSheets(); setShowSyncModal(false); }}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="sheet-surface will-change-transform"
            >
              <FocusTrap active={showSyncModal}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-brand-bg/80">
                <div>
                  <h2 className="text-lg font-semibold text-white">Settings</h2>
                </div>
                <button
                  onClick={() => setShowSyncModal(false)}
                  className="rounded-lg border border-white/10 p-3 text-brand-silver transition-colors hover:border-brand-cyan/25 hover:bg-brand-cyan/10 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 pb-24 space-y-4">
              <div className="rounded-xl bg-white/[0.03] blueprint-border p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-cyan/10 text-brand-cyan">
                    <Github size={19} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white">Connected to GitHub</h3>
                    <p className="truncate text-xs text-brand-silver">@{githubLogin}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void syncFromGist(true)}
                  disabled={!isOnline || isSyncingLibrary}
                  className={clsx(
                    'w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors blueprint-border',
                    !isOnline || isSyncingLibrary
                      ? 'bg-white/5 text-brand-silver/40 cursor-not-allowed'
                      : 'bg-brand-bg text-white hover:bg-brand-cyan/10'
                  )}
                >
                  <LoaderCircle size={16} className={isSyncingLibrary ? 'animate-spin' : undefined} />
                  {isSyncingLibrary ? 'Syncing' : 'Sync collection now'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowSyncModal(false);
                    disconnectGithub();
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-red-200 transition-colors hover:bg-red-500/10"
                >
                  <LogOut size={16} />
                  Disconnect GitHub
                </button>
              </div>

              <div className="pt-2 text-center space-y-1">
                <p className="text-xs text-brand-silver/50">Data provided by TMDB and IGDB.</p>
                <a
                  href="https://github.com/tinykings/void"
                  target="_blank"
                  rel="noreferrer"
                  className="block text-xs text-brand-silver/70 hover:text-brand-cyan transition-colors"
                >
                  github.com/tinykings/void
                  </a>
              </div>

              </div>
              <SheetDragHandle onClose={() => setShowSyncModal(false)} />
              </FocusTrap>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
