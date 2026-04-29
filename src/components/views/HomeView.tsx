'use client';

import { useEffect, useState, useMemo, useTransition, useCallback, useRef, type ChangeEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppContext } from '@/context/AppContext';
import { MediaCard } from '@/components/MediaCard';
import { MediaCardSkeleton } from '@/components/MediaCardSkeleton';
import { DetailsSheet } from '@/components/DetailsSheet';
import { PosterSheet } from '@/components/PosterSheet';
import { SearchSheet } from '@/components/SearchSheet';
import { sortMedia } from '@/lib/sort';
import { fromGistItem, type GistLibraryData } from '@/lib/gist';
import { checkVidAngelAvailability } from '@/lib/vidangel';
import { AlertCircle, X, Save, Eye, EyeOff, Download, Upload } from 'lucide-react';
import { clsx } from 'clsx';
import { toast } from 'sonner';

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
    showFavoritesOnly,
    setShowFavoritesOnly,
    gistId,
    gistToken,
    setGistId,
    setGistToken,
    syncFromGist,
    setVidAngelEnabled,
    vidAngelEnabled,
    editedStatusMap,
    setMediaEditedStatus,
    isSearchFocused,
    setIsSearchFocused,
    setLists,
  } = useAppContext();
  
  const [isPending, startTransition] = useTransition();

  // Status label (sort/filter feedback)
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [statusFading, setStatusFading] = useState(false);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistentStatus = useMemo(() => {
    if (showFavoritesOnly) return 'Favorites';
    return showWatched ? 'Watched' : 'Watchlist';
  }, [showFavoritesOnly, showWatched]);

  const showStatus = useCallback((label: string) => {
    // If it matches a persistent state, we don't need a timer
    if (label === 'Favorites' || label === 'Watched' || label === 'Watchlist') {
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
  const importInputRef = useRef<HTMLInputElement | null>(null);
  
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
    
    if (showFavoritesOnly) {
      filtered = filtered.filter(m => m.isFavorite);
    }

    return sortMedia(filtered, sort || 'added');
  }, [baseLibraryMedia, sort, showFavoritesOnly]);

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

  const handleExportBackup = () => {
    if (hasGistSync) return;

    const toBackupItem = (item: (typeof watchlist)[number]) => ({
      id: item.id,
      title: item.title || item.name || 'Unknown',
      media_type: item.media_type,
      date_added: item.date_added || new Date().toISOString(),
    });

    const backup: GistLibraryData = {
      version: 1,
      watchlist: watchlist.map(toBackupItem),
      watched: watched.map(toBackupItem),
      favorites: watched.filter((item) => item.isFavorite).map(toBackupItem),
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'void-library-backup.json';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    toast.success('Backup downloaded');
  };

  const handleImportBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    if (hasGistSync) return;

    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<GistLibraryData>;

      if (parsed.version !== 1 || !Array.isArray(parsed.watchlist) || !Array.isArray(parsed.watched) || !Array.isArray(parsed.favorites)) {
        throw new Error('Invalid backup file');
      }

      const favoriteKeys = new Set(parsed.favorites.map((item) => `${item.media_type}-${item.id}`));
      const nextWatchlist = parsed.watchlist.map((item) => fromGistItem(item));
      const nextWatched = parsed.watched.map((item) => fromGistItem(item, favoriteKeys.has(`${item.media_type}-${item.id}`)));

      setLists(nextWatchlist, nextWatched);
      toast.success('Backup restored');
    } catch {
      toast.error('Could not import backup');
    }
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
      }
    });

    showStatus(mode === 'watchlist' ? 'Watchlist' : mode === 'watched' ? 'Watched' : 'Favorites');
    setShowSortMenu(false);
    setShowLibraryMenu(null);
    window.scrollTo(0, 0);
  };
    
  const displayMedia = useMemo(() => libraryMedia.slice(0, visibleItemsCount), [libraryMedia, visibleItemsCount]);

  useEffect(() => {
    if (!vidAngelEnabled || displayMedia.length === 0) return;

    const pendingItems = displayMedia.filter((item) => editedStatusMap[`${item.media_type}-${item.id}`] === undefined);
    if (pendingItems.length === 0) return;

    let cancelled = false;

    void Promise.all(
      pendingItems.map(async (item) => {
        const slug = await checkVidAngelAvailability(item.title || item.name || '', item.id);
        if (!cancelled) {
          setMediaEditedStatus(item.id, item.media_type, !!slug);
        }
      })
    );

    return () => {
      cancelled = true;
    };
  }, [displayMedia, editedStatusMap, setMediaEditedStatus, vidAngelEnabled]);

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
                    showBadge={vidAngelEnabled}
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
                  Your list is empty
                </p>
                <p className="text-sm text-brand-silver max-w-xs mx-auto">
                  Search for movies and shows to add them to your watchlist.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      <DetailsSheet />
      <PosterSheet />
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
                    <div className="h-px bg-white/5 my-1" />

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
                        Settings
                      </div>
                    </button>
                  </div>
                )}
                <button
                  onClick={() => {
                    setShowLibraryMenu(null);
                    setShowSortMenu(false);
                    setShowSyncModal(true);
                  }}
                  className={clsx(
                    'w-full flex items-center justify-center py-2 px-2 rounded-lg text-xs font-bold transition-all',
                    showSyncModal
                      ? 'bg-brand-cyan/10 text-brand-cyan'
                      : 'text-brand-silver hover:text-white'
                  )}
                  title="Settings"
                >
                  Settings
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

      <AnimatePresence>
        {showSyncModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowSyncModal(false)}>
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
              className="relative w-full max-w-4xl h-[86vh] sm:h-[80vh] lg:h-[74vh] max-h-[92vh] bg-brand-bg/95 blueprint-border rounded-t-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-brand-bg/80">
                <div>
                  <h2 className="text-lg font-semibold text-white">Settings</h2>
                  <p className="text-xs text-brand-silver mt-1">Enter your Gist details to sync your library.</p>
                </div>
                <button
                  onClick={() => setShowSyncModal(false)}
                  className="p-2 text-brand-silver hover:text-white transition-colors bg-white/5 rounded-full"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
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

              <div className="rounded-xl bg-white/[0.03] blueprint-border p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">VidAngel</h3>
                  <p className="mt-1 text-xs text-brand-silver">
                    Show VidAngel availability badges in your library and details view.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setVidAngelEnabled(!vidAngelEnabled)}
                  className={clsx(
                    'w-full flex items-center justify-between rounded-xl px-4 py-3 transition-colors blueprint-border',
                    vidAngelEnabled ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-white/5 text-brand-silver hover:text-white'
                  )}
                >
                  <span className="text-sm font-bold">VidAngel badges</span>
                  <span className="text-[11px] font-black uppercase tracking-widest">
                    {vidAngelEnabled ? 'On' : 'Off'}
                  </span>
                </button>

                <a
                  href="https://www.vidangel.com/login"
                  target="_blank"
                  rel="noreferrer"
                  className="block text-[11px] font-medium text-brand-silver/70 hover:text-brand-cyan transition-colors"
                >
                  Login to Vidangel
                </a>
              </div>

              <div className="rounded-xl bg-white/[0.03] blueprint-border p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">Backup</h3>
                  <p className="mt-1 text-xs text-brand-silver">
                    Export a local JSON backup or restore one when Gist sync is disabled.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleExportBackup}
                    disabled={hasGistSync}
                    className={clsx(
                      'flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors blueprint-border',
                      hasGistSync
                        ? 'bg-white/5 text-brand-silver/40 cursor-not-allowed'
                        : 'bg-brand-bg text-white hover:bg-brand-cyan/10'
                    )}
                  >
                    <Download size={16} />
                    Export
                  </button>

                  <button
                    type="button"
                    onClick={() => importInputRef.current?.click()}
                    disabled={hasGistSync}
                    className={clsx(
                      'flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors blueprint-border',
                      hasGistSync
                        ? 'bg-white/5 text-brand-silver/40 cursor-not-allowed'
                        : 'bg-brand-bg text-white hover:bg-brand-cyan/10'
                    )}
                  >
                    <Upload size={16} />
                    Import
                  </button>
                </div>

                <p className={clsx('text-[11px]', hasGistSync ? 'text-brand-silver/50' : 'text-brand-silver/70')}>
                  {hasGistSync ? 'Disable Gist sync to use local backup.' : 'Imports replace your current local library.'}
                </p>

                <input
                  ref={importInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={handleImportBackup}
                />
              </div>

              <button
                onClick={handleSaveSync}
                className="w-full bg-brand-cyan text-brand-bg font-black py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-brand-cyan/90 active:scale-95 transition-all uppercase tracking-widest"
              >
                <Save size={18} />
                Save
              </button>

              <div className="pt-2 text-center space-y-1">
                <p className="text-xs text-brand-silver/50">Data provided by TMDB.</p>
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
