'use client';

import { useEffect, useState, useMemo, useTransition, useCallback, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Media } from '@/lib/types';
import { MediaCard } from '@/components/MediaCard';
import { MediaCardSkeleton } from '@/components/MediaCardSkeleton';
import { DetailsSheet } from '@/components/DetailsSheet';
import { SearchSheet } from '@/components/SearchSheet';
import { sortMedia } from '@/lib/sort';
import { AlertCircle, X, ShieldCheck, Check, Save, Eye, EyeOff } from 'lucide-react';
import { clsx } from 'clsx';

export const HomeView = () => {
  const {
    isLoaded, 
    watchlist, 
    watched,
    filter,
    setFilter,
    sort,
    setSort,
    showWatched,
    setShowWatched,
    showEditedOnly,
    setShowEditedOnly,
    showFavoritesOnly,
    setShowFavoritesOnly,
    gistId,
    gistToken,
    setGistId,
    setGistToken,
    syncFromGist,
    editedStatusMap,
    isSearchFocused,
    setIsSearchFocused,
  } = useAppContext();
  
  const [isPending, startTransition] = useTransition();

  // Status label (sort/filter feedback)
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [statusFading, setStatusFading] = useState(false);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistentStatus = useMemo(() => {
    if (showFavoritesOnly) return 'Favorites';
    if (showEditedOnly) return 'Edited';
    return showWatched ? 'Watched' : 'Watchlist';
  }, [showFavoritesOnly, showEditedOnly, showWatched]);

  const showStatus = useCallback((label: string) => {
    // If it matches a persistent state, we don't need a timer
    if (label === 'Favorites' || label === 'Edited' || label === 'Watched' || label === 'Watchlist') {
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
  }, []);

  const [error, setError] = useState<string | null>(null);

  // Sort dropdown state
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showLibraryMenu, setShowLibraryMenu] = useState<'movie' | 'tv' | null>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [tempGistId, setTempGistId] = useState(gistId || '');
  const [tempGistToken, setTempGistToken] = useState(gistToken || '');
  const [showSyncToken, setShowSyncToken] = useState(false);
  
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

  const showLibrary = !isSearchFocused;
  const isLibraryEmpty = watchlist.length === 0 && watched.length === 0;

  // Combine and process library media
  const baseLibraryMedia = useMemo(() => {
    const combined = showWatched ? watched : watchlist;
    return combined.filter(m => m.media_type === (filter || 'movie'));
  }, [watchlist, watched, filter, showWatched]);

  const libraryMedia = useMemo(() => {
    let filtered = [...baseLibraryMedia];

    if (showEditedOnly) {
      // Show items that are confirmed edited OR haven't been checked yet
      filtered = filtered.filter(m => editedStatusMap[`${m.media_type}-${m.id}`] !== false);
    }
    
    if (showFavoritesOnly) {
      filtered = filtered.filter(m => m.isFavorite);
    }

    return sortMedia(filtered, sort || 'added');
  }, [baseLibraryMedia, sort, showEditedOnly, editedStatusMap, showFavoritesOnly]);

  const hasGistSync = !!(gistId && gistToken);
  const activeLibraryMode = showFavoritesOnly ? 'favorites' : showWatched ? 'watched' : 'watchlist';

  useEffect(() => {
    if (!showSyncModal) return;
    setTempGistId(gistId || '');
    setTempGistToken(gistToken || '');
    setShowSyncToken(false);
  }, [showSyncModal, gistId, gistToken]);

  const handleSaveSync = () => {
    const nextGistId = tempGistId.trim();
    const nextGistToken = tempGistToken.trim();

    setGistId(nextGistId);
    setGistToken(nextGistToken);

    if (nextGistId && nextGistToken) {
      void syncFromGist();
    }

    setShowSyncModal(false);
    setShowSortMenu(false);
  };

  const handleEditedFilterClick = () => {
    if (showEditedOnly) {
      startTransition(() => {
        setShowEditedOnly(false);
        setShowFavoritesOnly(false);
      });
      showStatus('Showing All');
      setShowSortMenu(false);
      return;
    }

    startTransition(() => {
      setShowEditedOnly(true);
      setShowFavoritesOnly(false);
    });
    showStatus('Edited');
    setShowSortMenu(false);
  };

  const selectLibraryMenuOption = (nextFilter: 'movie' | 'tv', mode: 'watchlist' | 'watched' | 'favorites') => {
    startTransition(() => {
      setFilter(nextFilter);

      if (mode === 'watchlist') {
        setShowWatched(false);
        setShowFavoritesOnly(false);
      } else if (mode === 'watched') {
        setShowWatched(true);
        setShowFavoritesOnly(false);
      } else {
        setShowWatched(true);
        setShowFavoritesOnly(true);
        setShowEditedOnly(false);
      }
    });

    showStatus(mode === 'watchlist' ? 'Watchlist' : mode === 'watched' ? 'Watched' : 'Favorites');
    setShowSortMenu(false);
    setShowLibraryMenu(null);
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
  }, [filter, sort, showWatched, showEditedOnly, showFavoritesOnly]);

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
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl flex items-start gap-3 mb-6 border border-red-100 dark:border-red-900/30">
          <AlertCircle size={20} className="mt-0.5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {[...Array(12)].map((_, i) => (
            <MediaCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          {displayMedia.length > 0 ? (
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
              {displayMedia.map((item, index) => (
                <div
                  key={`${item.media_type}-${item.id}`}
                  ref={(node) => lastItemRef(index === displayMedia.length - 1 ? node : null)}
                >
                  <MediaCard
                    media={{
                      ...item,
                      isEdited: editedStatusMap[`${item.media_type}-${item.id}`]
                    }}
                    showBadge={showEditedOnly}
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
                  {showEditedOnly ? 'No edited titles found' : 'Your list is empty'}
                </p>
                <p className="text-sm text-brand-silver max-w-xs mx-auto">
                  {showEditedOnly
                    ? 'If you just logged into VidAngel, come back and try again. Otherwise there may simply be no edited matches in this view.'
                    : 'Search for movies and shows to add them to your watchlist.'}
                </p>
              </div>
            </div>
          )}
        </>
      )}

      <DetailsSheet />
      <SearchSheet />

      {/* Fixed Bottom Bar */}
      {!isSearchFocused && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-brand-bg/40 backdrop-blur-xl border-t border-white/[0.04]">
          {/* Floating status pill — pops up above the bar */}
          <div
            aria-live="polite"
            className={clsx(
              "absolute left-1/2 -translate-x-1/2 bottom-full mb-3 px-4 py-1.5 rounded-full bg-brand-bg/80 backdrop-blur-md border border-brand-cyan/20 text-xs font-semibold tracking-widest uppercase text-brand-cyan whitespace-nowrap transition-all duration-300 pointer-events-none",
              (persistentStatus || (statusLabel && !statusFading))
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-3"
            )}
          >
            {persistentStatus || statusLabel}
          </div>

          <div className="max-w-7xl mx-auto px-4 py-2 relative">
            <div className="grid grid-cols-4 gap-2">
              <div className="relative rounded-xl bg-brand-bg/50 blueprint-border p-1">
                {showSortMenu && (
                  <div className="absolute bottom-full left-0 mb-2 py-2 w-48 rounded-xl bg-brand-bg blueprint-border shadow-xl z-20">
                    <button
                      onClick={() => {
                        startTransition(() => setSort('added'));
                        showStatus('Recently Added');
                        setShowSortMenu(false);
                      }}
                      className={clsx(
                        'w-full px-4 py-2 text-left text-sm font-bold flex items-center gap-2 transition-colors',
                        (sort || 'added') === 'added'
                          ? 'text-brand-cyan'
                          : 'text-brand-silver hover:text-white hover:bg-brand-bg/50'
                      )}
                    >
                      Recently Added
                    </button>
                    <button
                      onClick={() => {
                        startTransition(() => setSort('title'));
                        showStatus('Title A–Z');
                        setShowSortMenu(false);
                      }}
                      className={clsx(
                        'w-full px-4 py-2 text-left text-sm font-bold flex items-center gap-2 transition-colors',
                        sort === 'title'
                          ? 'text-brand-cyan'
                          : 'text-brand-silver hover:text-white hover:bg-brand-bg/50'
                      )}
                    >
                      Title
                    </button>
                    <button
                      onClick={() => {
                        startTransition(() => setSort('release'));
                        showStatus('Release Date');
                        setShowSortMenu(false);
                      }}
                      className={clsx(
                        'w-full px-4 py-2 text-left text-sm font-bold flex items-center gap-2 transition-colors',
                        sort === 'release'
                          ? 'text-brand-cyan'
                          : 'text-brand-silver hover:text-white hover:bg-brand-bg/50'
                      )}
                    >
                      Release Date
                    </button>

                    <div className="h-px bg-white/5 my-1" />

                    <button
                      onClick={() => {
                        void handleEditedFilterClick();
                      }}
                      className={clsx(
                        'w-full px-4 py-2 text-left text-sm font-bold flex items-center justify-between transition-colors',
                        showEditedOnly
                          ? 'text-amber-500 bg-amber-500/5'
                          : 'text-brand-silver hover:text-white hover:bg-brand-bg/50'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={16} className={showEditedOnly ? 'fill-current' : ''} />
                        Edited
                      </div>
                      {showEditedOnly && <Check size={14} className="text-amber-500" />}
                    </button>

                    <button
                      onClick={() => {
                        setShowSyncModal(true);
                        setShowSortMenu(false);
                      }}
                      className={clsx(
                        'w-full px-4 py-2 text-left text-sm font-bold flex items-center justify-between transition-colors',
                        hasGistSync
                          ? 'text-emerald-400 bg-emerald-500/5'
                          : 'text-brand-silver hover:text-white hover:bg-brand-bg/50'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="relative flex items-center justify-center w-4 h-4">
                          {hasGistSync && <span className="absolute w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />}
                        </span>
                        Sync
                      </div>
                    </button>
                  </div>
                )}
                <button
                  onClick={() => {
                    setShowLibraryMenu(null);
                    setShowSortMenu(!showSortMenu);
                  }}
                  className={clsx(
                    'w-full flex items-center justify-center py-2 px-2 rounded-lg text-xs font-bold transition-all',
                    showSortMenu
                      ? 'bg-brand-cyan/10 text-brand-cyan'
                      : 'text-brand-silver hover:text-white'
                  )}
                  title="Sort & Filter"
                >
                  Filter
                </button>
              </div>

              <div className="relative rounded-xl bg-brand-bg/50 blueprint-border p-1">
                {showLibraryMenu === 'movie' && (
                  <div className="absolute bottom-full left-0 mb-2 w-44 rounded-xl bg-brand-bg blueprint-border shadow-xl overflow-hidden">
                    <button
                      onClick={() => selectLibraryMenuOption('movie', 'watchlist')}
                      className={clsx(
                        'w-full px-3 py-3 text-left text-sm font-bold transition-colors',
                        (filter || 'movie') === 'movie' && activeLibraryMode === 'watchlist'
                          ? 'text-brand-cyan bg-brand-cyan/5'
                          : 'text-brand-silver hover:text-white hover:bg-brand-bg/50'
                      )}
                    >
                      Watchlist
                    </button>
                    <button
                      onClick={() => selectLibraryMenuOption('movie', 'watched')}
                      className={clsx(
                        'w-full px-3 py-3 text-left text-sm font-bold transition-colors',
                        (filter || 'movie') === 'movie' && activeLibraryMode === 'watched'
                          ? 'text-brand-cyan bg-brand-cyan/5'
                          : 'text-brand-silver hover:text-white hover:bg-brand-bg/50'
                      )}
                    >
                      Watched
                    </button>
                    <button
                      onClick={() => selectLibraryMenuOption('movie', 'favorites')}
                      className={clsx(
                        'w-full px-3 py-3 text-left text-sm font-bold transition-colors',
                        (filter || 'movie') === 'movie' && activeLibraryMode === 'favorites'
                          ? 'text-brand-cyan bg-brand-cyan/5'
                          : 'text-brand-silver hover:text-white hover:bg-brand-bg/50'
                      )}
                    >
                      Favorites
                    </button>
                  </div>
                )}
                <button
                  onClick={() => {
                    setShowSortMenu(false);
                    setShowLibraryMenu((current) => current === 'movie' ? null : 'movie');
                  }}
                  className={clsx(
                    'w-full flex items-center justify-center py-2 px-2 rounded-lg text-xs font-bold transition-all',
                    (filter || 'movie') === 'movie'
                      ? 'bg-brand-cyan/10 text-brand-cyan shadow-[0_0_15px_rgba(34,211,238,0.1)]' 
                      : 'text-brand-silver hover:text-white'
                  )}
                >
                  Movies
                </button>
              </div>

              <div className="relative rounded-xl bg-brand-bg/50 blueprint-border p-1">
                {showLibraryMenu === 'tv' && (
                  <div className="absolute bottom-full right-0 mb-2 w-44 rounded-xl bg-brand-bg blueprint-border shadow-xl overflow-hidden">
                    <button
                      onClick={() => selectLibraryMenuOption('tv', 'watchlist')}
                      className={clsx(
                        'w-full px-3 py-3 text-left text-sm font-bold transition-colors',
                        filter === 'tv' && activeLibraryMode === 'watchlist'
                          ? 'text-brand-cyan bg-brand-cyan/5'
                          : 'text-brand-silver hover:text-white hover:bg-brand-bg/50'
                      )}
                    >
                      Watchlist
                    </button>
                    <button
                      onClick={() => selectLibraryMenuOption('tv', 'watched')}
                      className={clsx(
                        'w-full px-3 py-3 text-left text-sm font-bold transition-colors',
                        filter === 'tv' && activeLibraryMode === 'watched'
                          ? 'text-brand-cyan bg-brand-cyan/5'
                          : 'text-brand-silver hover:text-white hover:bg-brand-bg/50'
                      )}
                    >
                      Watched
                    </button>
                    <button
                      onClick={() => selectLibraryMenuOption('tv', 'favorites')}
                      className={clsx(
                        'w-full px-3 py-3 text-left text-sm font-bold transition-colors',
                        filter === 'tv' && activeLibraryMode === 'favorites'
                          ? 'text-brand-cyan bg-brand-cyan/5'
                          : 'text-brand-silver hover:text-white hover:bg-brand-bg/50'
                      )}
                    >
                      Favorites
                    </button>
                  </div>
                )}
                <button
                  onClick={() => {
                    setShowSortMenu(false);
                    setShowLibraryMenu((current) => current === 'tv' ? null : 'tv');
                  }}
                  className={clsx(
                    'w-full flex items-center justify-center py-2 px-2 rounded-lg text-xs font-bold transition-all',
                    filter === 'tv'
                      ? 'bg-brand-cyan/10 text-brand-cyan shadow-[0_0_15px_rgba(34,211,238,0.1)]' 
                      : 'text-brand-silver hover:text-white'
                  )}
                >
                  Shows
                </button>
              </div>

              <div className="rounded-xl bg-brand-bg/50 blueprint-border p-1">
                <button
                  onClick={() => {
                    startTransition(() => setIsSearchFocused(true));
                    setShowSortMenu(false);
                    setShowLibraryMenu(null);
                  }}
                  className="w-full flex items-center justify-center py-2 px-2 rounded-lg text-xs font-bold text-brand-silver hover:text-white transition-all"
                >
                  Search
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSyncModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-brand-bg blueprint-border shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div>
                <h2 className="text-lg font-semibold text-white">Sync</h2>
                <p className="text-xs text-brand-silver mt-1">Enter your Gist details to sync your library.</p>
              </div>
              <button
                onClick={() => setShowSyncModal(false)}
                className="p-2 text-brand-silver hover:text-white transition-colors"
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
                    type={showSyncToken ? 'text' : 'password'}
                    value={tempGistToken}
                    onChange={(e) => setTempGistToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxx"
                    className="w-full p-3 pr-12 rounded-lg bg-brand-bg blueprint-border text-white focus:ring-1 focus:ring-brand-cyan outline-none transition-all placeholder:text-brand-silver/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSyncToken((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-silver hover:text-white"
                  >
                    {showSyncToken ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                onClick={handleSaveSync}
                className="w-full bg-brand-cyan text-brand-bg font-black py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-brand-cyan/90 active:scale-95 transition-all uppercase tracking-widest"
              >
                <Save size={18} />
                Save Sync
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
