'use client';

import { useEffect, useState, useMemo, useTransition, useCallback, useRef, type ChangeEvent } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppContext } from '@/context/AppContext';
import { ActorSheet } from '@/components/ActorSheet';
import { MediaCard } from '@/components/MediaCard';
import { MediaCardSkeleton } from '@/components/MediaCardSkeleton';
import { DetailsSheet } from '@/components/DetailsSheet';
import { SearchSheet } from '@/components/SearchSheet';
import { sortMedia } from '@/lib/sort';
import { fromGistItem, type GistLibraryData } from '@/lib/gist';
import { getContentRating, getImageUrl, getUSStreamingProviders, getWatchProviders } from '@/lib/tmdb';
import { mapWithConcurrency } from '@/lib/concurrency';
import { checkVidAngelAvailability } from '@/lib/vidangel';
import { AlertCircle, Bookmark, Clapperboard, Download, Eye, EyeOff, Film, Heart, Library, LoaderCircle, Radio, Save, Search, Settings, SlidersHorizontal, Tv, Upload, X } from 'lucide-react';
import type { FilterType, Media, WatchProvider } from '@/lib/types';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { SheetDragHandle } from '@/components/SheetDragHandle';

type LibraryMode = 'library' | 'watchlist';
type StreamProviderItem = {
  media: Media;
  contentRating: string | null;
};
type StreamProviderGroup = {
  provider: WatchProvider;
  items: StreamProviderItem[];
};

const STREAM_PROVIDER_CONCURRENCY = 2;

const getMediaTitle = (media: Media) => media.title || media.name || 'Unknown title';
const getStreamPosterUrl = (media: Media) => {
  const path = media.poster_path || media.backdrop_path;
  return path ? getImageUrl(path, 'w185') : '';
};

export const HomeView = () => {
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
    gistId,
    gistToken,
    setGistId,
    setGistToken,
    syncFromGist,
    isSyncingLibrary,
    setVidAngelEnabled,
    setMediaEditedStatus,
    vidAngelEnabled,
    editedStatusMap,
    isSearchFocused,
    setIsSearchFocused,
    closeAllSheets,
    setLists,
    openDetails,
  } = useAppContext();
  
  const [isPending, startTransition] = useTransition();

  // Status label (sort/filter feedback)
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [statusFading, setStatusFading] = useState(false);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeFilter = filter || 'all';
  const activeLibraryMode: LibraryMode = showWatched ? 'library' : 'watchlist';
  const [showStreamView, setShowStreamView] = useState(false);
  const [streamGroups, setStreamGroups] = useState<StreamProviderGroup[]>([]);
  const [isStreamLoading, setIsStreamLoading] = useState(false);
  const [streamFailureCount, setStreamFailureCount] = useState(0);
  const editedStatusMapRef = useRef(editedStatusMap);
  const activeModeLabel = showStreamView ? 'Stream' : showFavoritesOnly ? 'Favorites' : activeLibraryMode === 'library' ? 'Library' : 'Watchlist';
  const activeFilterLabel = activeFilter === 'all' ? 'All' : activeFilter === 'movie' ? 'Movies' : 'Shows';

  const persistentStatus = useMemo(() => {
    if (showStreamView) return 'Stream · Watchlist';
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

    return sortMedia(filtered);
  }, [baseLibraryMedia, showFavoritesOnly]);

  useEffect(() => {
    editedStatusMapRef.current = editedStatusMap;
  }, [editedStatusMap]);

  const watchlistStreamKey = useMemo(() => {
    return watchlist.map((item) => `${item.media_type}-${item.id}`).join('|');
  }, [watchlist]);

  useEffect(() => {
    if (!showStreamView) return;

    if (!apiKey || watchlist.length === 0) {
      setStreamGroups([]);
      setStreamFailureCount(0);
      setIsStreamLoading(false);
      return;
    }

    let cancelled = false;
    setIsStreamLoading(true);
    setStreamFailureCount(0);

    void mapWithConcurrency(watchlist, STREAM_PROVIDER_CONCURRENCY, async (item) => {
      let providers: WatchProvider[] = [];
      let failed = false;
      let isVidAngelAvailable = false;
      const mediaKey = `${item.media_type}-${item.id}`;

      const providerPromise = getWatchProviders(item.id, item.media_type, apiKey)
        .then((data) => {
          providers = getUSStreamingProviders(data);
        })
        .catch(() => {
          failed = true;
        });
      const contentRatingPromise = getContentRating(item.id, item.media_type, apiKey).catch(() => null);
      const vidAngelPromise = vidAngelEnabled
        ? editedStatusMapRef.current[mediaKey] !== undefined
          ? Promise.resolve(editedStatusMapRef.current[mediaKey])
          : checkVidAngelAvailability(getMediaTitle(item), item.id)
              .then((slug) => {
                const available = !!slug;
                setMediaEditedStatus(item.id, item.media_type, available);
                return available;
              })
              .catch(() => false)
        : Promise.resolve(false);

      const [, contentRating, vidAngelAvailable] = await Promise.all([
        providerPromise,
        contentRatingPromise,
        vidAngelPromise,
      ]);
      isVidAngelAvailable = vidAngelAvailable;

      return {
        item,
        providers,
        contentRating,
        isVidAngelAvailable,
        failed,
      };
    })
      .then((results) => {
        if (cancelled) return;

        const groupsByProvider = new Map<number, StreamProviderGroup>();

        const vidAngelItems: StreamProviderItem[] = [];

        results.forEach(({ item, providers, contentRating, isVidAngelAvailable }) => {
          if (isVidAngelAvailable) {
            vidAngelItems.push({ media: item, contentRating });
          }

          providers.forEach((provider) => {
            const streamItem = { media: item, contentRating };
            const existing = groupsByProvider.get(provider.provider_id);
            if (existing) {
              existing.items.push(streamItem);
              return;
            }

            groupsByProvider.set(provider.provider_id, {
              provider,
              items: [streamItem],
            });
          });
        });

        const groups = Array.from(groupsByProvider.values())
          .map((group) => ({
            ...group,
            items: [...group.items].sort((a, b) => getMediaTitle(a.media).localeCompare(getMediaTitle(b.media))),
          }))
          .sort((a, b) => {
            const countDiff = b.items.length - a.items.length;
            if (countDiff !== 0) return countDiff;
            return a.provider.provider_name.localeCompare(b.provider.provider_name);
          });

        if (vidAngelEnabled && vidAngelItems.length > 0) {
          groups.unshift({
            provider: {
              provider_id: -1,
              provider_name: 'VidAngel',
              logo_path: '',
            },
            items: vidAngelItems.sort((a, b) => getMediaTitle(a.media).localeCompare(getMediaTitle(b.media))),
          });
        }

        setStreamGroups(groups);
        setStreamFailureCount(results.filter((result) => result.failed).length);
      })
      .finally(() => {
        if (!cancelled) setIsStreamLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, setMediaEditedStatus, showStreamView, vidAngelEnabled, watchlist, watchlistStreamKey]);

  const hasGistSync = !!(gistId && gistToken);
  const emptyTitle = (() => {
    if (showStreamView) return watchlist.length === 0 ? 'Your watchlist is empty' : 'No streaming providers found';
    if (showFavoritesOnly) return 'No favorites yet';
    if (activeLibraryMode === 'library') return 'Your library is empty';
    return 'Your watchlist is empty';
  })();
  const emptyDescription = (() => {
    if (showStreamView) {
      if (watchlist.length === 0) return 'Search for movies and shows to add them to your watchlist.';
      return 'No US free or subscription providers were found for your watchlist.';
    }

    if (activeFilter !== 'all') {
      return `No ${activeFilterLabel.toLowerCase()} found in ${activeModeLabel.toLowerCase()}.`;
    }

    if (showFavoritesOnly) return 'Mark watched movies and shows as favorites to see them here.';
    if (activeLibraryMode === 'library') return 'Mark movies and shows as watched to build your library.';
    return 'Search for movies and shows to add them to your watchlist.';
  })();

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
    setShowTypeMenu(false);
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

  const selectTypeFilter = (nextFilter: FilterType) => {
    startTransition(() => {
      setShowStreamView(false);
      setFilter(nextFilter);
    });

    showStatus(nextFilter === 'all' ? 'All' : nextFilter === 'movie' ? 'Movies' : 'Shows');
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

    showStatus(mode === 'library' ? 'Library' : 'Watchlist');
    setShowTypeMenu(false);
    window.scrollTo(0, 0);
  };

  const clearActiveFilterView = () => {
    startTransition(() => {
      setShowStreamView(false);
      setShowFavoritesOnly(false);
      setIsSearchFocused(false);
    });

    showStatus(activeLibraryMode === 'library' ? 'Library' : 'Watchlist');
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
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl flex items-start gap-3 mb-6 border border-red-100 dark:border-red-900/30">
          <AlertCircle size={20} className="mt-0.5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {isLoading && !showStreamView ? (
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {[...Array(12)].map((_, i) => (
            <MediaCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          {showStreamView ? (
            <div className="mx-auto max-w-3xl space-y-3">
              <div className="flex items-end justify-between gap-4 px-1">
                <div>
                  <h1 className="text-xl font-black uppercase tracking-[0.18em] text-white">Stream</h1>
                  <p className="mt-1 text-xs font-medium text-brand-silver">
                    US free and subscription providers for your watchlist. Data provided by JustWatch.
                  </p>
                </div>
                <div className="shrink-0 rounded-full border border-brand-cyan/20 bg-brand-cyan/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-brand-cyan">
                  {watchlist.length}
                </div>
              </div>

              {isStreamLoading ? (
                <div className="space-y-2 pt-3">
                  {[...Array(5)].map((_, index) => (
                    <div key={index} className="h-14 animate-pulse rounded-xl blueprint-border bg-white/[0.03]" />
                  ))}
                </div>
              ) : streamGroups.length > 0 ? (
                <div className="space-y-4 pt-2">
                  {streamFailureCount > 0 && (
                    <p className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-xs font-medium text-amber-100">
                      {streamFailureCount} {streamFailureCount === 1 ? 'title could' : 'titles could'} not be checked.
                    </p>
                  )}

                  {streamGroups.map((group) => (
                    <section key={group.provider.provider_id} className="overflow-hidden rounded-xl blueprint-border bg-white/[0.03]">
                      <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
                        <h2 className="min-w-0 truncate text-sm font-black uppercase tracking-[0.16em] text-white">
                          {group.provider.provider_name}
                        </h2>
                        <span className="shrink-0 rounded-full bg-brand-cyan/10 px-2.5 py-1 text-[11px] font-black text-brand-cyan">
                          {group.items.length}
                        </span>
                      </div>

                      <div className="divide-y divide-white/5">
                        {group.items.map(({ media, contentRating }) => {
                          const posterUrl = getStreamPosterUrl(media);

                          return (
                            <button
                              key={`${group.provider.provider_id}-${media.media_type}-${media.id}`}
                              type="button"
                              onClick={() => openDetails(media)}
                              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-brand-silver transition-colors hover:bg-brand-cyan/10 hover:text-white"
                            >
                              <div className="h-12 w-8 shrink-0 overflow-hidden rounded-md bg-brand-bg/80 ring-1 ring-white/10">
                                {posterUrl ? (
                                  <Image
                                    src={posterUrl}
                                    alt=""
                                    width={32}
                                    height={48}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-brand-silver/40">
                                    <Film size={14} />
                                  </div>
                                )}
                              </div>

                              <span className="min-w-0 flex-1 truncate">{getMediaTitle(media)}</span>
                              <span className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-brand-silver/70">
                                {contentRating || 'N/A'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </section>
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
                    {streamFailureCount > 0 && (
                      <p className="text-xs text-brand-silver/60">
                        {streamFailureCount} {streamFailureCount === 1 ? 'title could' : 'titles could'} not be checked.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : displayMedia.length > 0 ? (
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
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-brand-cyan/20 bg-brand-bg/90 px-5 py-4 text-center shadow-2xl shadow-black/40 backdrop-blur-md">
              <LoaderCircle size={22} className="animate-spin text-brand-cyan" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">Syncing library</p>
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

          <div className="max-w-sm mx-auto relative pointer-events-auto">
            <div className="grid grid-cols-[56px_1fr_56px] items-center gap-2 rounded-[28px] bg-brand-bg/70 backdrop-blur-xl blueprint-border p-2 shadow-2xl shadow-black/35">
              <div className="relative">
                {showTypeMenu && (
                  <div className="absolute bottom-full left-0 mb-3 w-44 rounded-2xl bg-brand-bg blueprint-border shadow-xl overflow-hidden">
                    {[
                      { id: 'all' as const, label: 'All', icon: Clapperboard },
                      { id: 'movie' as const, label: 'Movies', icon: Film },
                      { id: 'tv' as const, label: 'Shows', icon: Tv },
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
                          ? 'text-red-200 bg-red-500/15'
                          : 'text-brand-silver hover:text-white hover:bg-brand-bg/50'
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
                    'flex h-12 w-12 items-center justify-center rounded-full transition-all',
                    showStreamView || showFavoritesOnly
                      ? 'bg-red-500/15 text-red-200 shadow-[0_0_18px_rgba(239,68,68,0.16)] hover:bg-red-500/25 hover:text-white'
                      : showTypeMenu || activeFilter !== 'all'
                      ? 'bg-brand-cyan/12 text-brand-cyan shadow-[0_0_18px_rgba(34,211,238,0.16)]'
                      : 'text-brand-silver hover:text-white'
                  )}
                  aria-label={showStreamView ? 'Clear Stream view' : showFavoritesOnly ? 'Clear Favorites view' : `Filter: ${activeFilterLabel}`}
                  title={showStreamView ? 'Clear Stream view' : showFavoritesOnly ? 'Clear Favorites view' : `Filter: ${activeFilterLabel}`}
                >
                  {showStreamView || showFavoritesOnly ? <X size={20} /> : <SlidersHorizontal size={19} />}
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
                  aria-label="Library"
                  title="Library"
                >
                  <Library size={18} />
                </button>

                <button
                  type="button"
                  onClick={() => selectLibraryMode('watchlist')}
                  className={clsx(
                    'relative z-10 flex h-10 items-center justify-center rounded-full transition-colors',
                    activeLibraryMode === 'watchlist' && !showFavoritesOnly && !showStreamView ? 'text-brand-cyan' : 'text-brand-silver hover:text-white'
                  )}
                  aria-label="Watchlist"
                  title="Watchlist"
                >
                  <Bookmark size={18} />
                </button>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    startTransition(() => {
                      setShowStreamView(false);
                      setIsSearchFocused(true);
                    });
                    setShowTypeMenu(false);
                  }}
                  className="flex h-12 w-12 items-center justify-center rounded-full text-brand-silver hover:bg-brand-cyan/10 hover:text-white transition-all"
                  aria-label="Search"
                  title="Search"
                >
                  <Search size={19} />
                </button>
              </div>
            </div>
          </div>
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
              className="relative w-full max-w-4xl h-[86vh] sm:h-[80vh] lg:h-[74vh] max-h-[92vh] bg-brand-bg/95 embossed-edge rounded-t-3xl overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-brand-bg/80">
                <div>
                  <h2 className="text-lg font-semibold text-white">Settings</h2>
                </div>
                <button
                  onClick={() => setShowSyncModal(false)}
                  className="p-2 rounded-lg bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/25 shadow-[0_0_15px_rgba(34,211,238,0.1)] transition-all hover:bg-brand-cyan/20 hover:text-white hover:border-brand-cyan/40"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-5 pb-24 space-y-4">
              <div className="rounded-xl bg-white/[0.03] blueprint-border p-4 space-y-3">
                 <div>
                   <h3 className="text-sm font-semibold text-white">Gist Sync</h3>
                 </div>

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
                   type="button"
                   onClick={() => {
                     setShowSyncModal(false);
                     setShowTypeMenu(false);
                     void syncFromGist();
                   }}
                   disabled={!hasGistSync || isSyncingLibrary}
                   className={clsx(
                     'w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors blueprint-border',
                     !hasGistSync || isSyncingLibrary
                       ? 'bg-white/5 text-brand-silver/40 cursor-not-allowed'
                       : 'bg-brand-bg text-white hover:bg-brand-cyan/10'
                   )}
                 >
                   <LoaderCircle size={16} className={isSyncingLibrary ? 'animate-spin' : undefined} />
                   {isSyncingLibrary ? 'Syncing' : 'Sync library now'}
                 </button>
               </div>

              <div className="rounded-xl bg-white/[0.03] blueprint-border p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">VidAngel</h3>
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
              <SheetDragHandle onClose={() => setShowSyncModal(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
