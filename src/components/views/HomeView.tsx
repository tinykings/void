'use client';

import { useEffect, useState, useMemo, useTransition, useCallback, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getTrending, searchMedia } from '@/lib/tmdb';
import { Media } from '@/lib/types';
import { MediaCard } from '@/components/MediaCard';
import { MediaCardSkeleton } from '@/components/MediaCardSkeleton';
import { FilterTabs } from '@/components/FilterTabs';
import { sortMedia } from '@/lib/sort';
import { AlertCircle, Settings, Search as SearchIcon, X, ArrowLeft, ArrowRight, ShieldCheck, Bookmark, CheckCircle2, Heart, SlidersHorizontal, Check } from 'lucide-react';
import { clsx } from 'clsx';

interface HomeViewProps {
  onGoToSettings: () => void;
}

export const HomeView = ({ onGoToSettings }: HomeViewProps) => {
  const { 
    apiKey, 
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
    updateMediaMetadata,
    editedStatusMap,
    isSearchFocused,
    setIsSearchFocused,
    vidAngelEnabled,
    syncFromTMDB
  } = useAppContext();
  
  const [isPending, startTransition] = useTransition();

  // Status label (sort/filter feedback)
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [statusFading, setStatusFading] = useState(false);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistentStatus = useMemo(() => {
    if (showFavoritesOnly) return 'Favorites';
    if (showEditedOnly) return 'Edited';
    return null;
  }, [showFavoritesOnly, showEditedOnly]);

  const showStatus = useCallback((label: string) => {
    // If it matches a persistent state, we don't need a timer
    if (label === 'Favorites' || label === 'Edited') {
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

  // Trending State
  const [trending, setTrending] = useState<Media[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  
  // Local Search State
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Media[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchAbortController = useRef<AbortController | null>(null);
  
  const [error, setError] = useState<string | null>(null);

  // Sort dropdown state
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Pagination for library
  const [visibleItemsCount, setVisibleItemsCount] = useState(24);
  const itemsPerPage = 24;
  const observer = useRef<IntersectionObserver | null>(null);

  // Auto-hiding footer state
  const [isFooterVisible, setIsFooterVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Always show at the top or if searching
      if (currentScrollY < 10) {
        setIsFooterVisible(true);
        lastScrollY.current = currentScrollY;
        return;
      }

      // Only toggle visibility if we've scrolled a minimum distance (to avoid jitter)
      if (Math.abs(currentScrollY - lastScrollY.current) < 10) return;

      if (currentScrollY > lastScrollY.current) {
        // Scrolling down
        setIsFooterVisible(false);
      } else {
        // Scrolling up
        setIsFooterVisible(true);
      }
      
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isSearching = searchResults.length > 0 || searchLoading || (query.length > 0 && isSearchFocused);
  const showTrending = isSearchFocused && searchResults.length === 0 && !searchLoading;
  const showLibrary = !isSearchFocused && query.length === 0;

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
  }, [baseLibraryMedia, sort, showEditedOnly, editedStatusMap, showFavoritesOnly, showWatched]);

  const fullList = useMemo(() => {
    let list = searchResults.length > 0 
      ? searchResults 
      : (showTrending ? trending : libraryMedia);

    if (showEditedOnly && (isSearching || showTrending)) {
      list = list.filter(m => editedStatusMap[`${m.media_type}-${m.id}`] !== false);
    }
    return list;
  }, [searchResults, trending, libraryMedia, showEditedOnly, isSearching, showTrending, editedStatusMap]);
    
  const displayMedia = useMemo(() => fullList.slice(0, visibleItemsCount), [fullList, visibleItemsCount]);

  const isLoading = searchLoading || (showTrending ? trendingLoading : isPending);

  const lastItemRef = useCallback((node: HTMLDivElement) => {
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (node && entries[0].isIntersecting) {
        setVisibleItemsCount(prev => prev + itemsPerPage);
      }
    });
    if (node) observer.current.observe(node);
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleItemsCount(itemsPerPage);
  }, [filter, sort, showWatched, showEditedOnly, showFavoritesOnly, isSearchFocused, query]);

  // Reset Edited filter when switching views or searching (but not on initial mount)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setShowEditedOnly(false);
  }, [isSearchFocused, query, setShowEditedOnly]);

  // Reset favorites filter when leaving watched view
  useEffect(() => {
    if (!showWatched) {
      setShowFavoritesOnly(false);
    }
  }, [showWatched, setShowFavoritesOnly]);

  // Fetch Trending when search is focused
  useEffect(() => {
    if (isLoaded && apiKey && isSearchFocused && trending.length === 0) {
      setTrendingLoading(true);
      getTrending(apiKey, 'all')
        .then((items) => {
          const processed = items.map(item => ({
            ...item,
            media_type: item.media_type || 'movie'
          })) as Media[];
          setTrending(processed);
        })
        .catch((err) => setError(err.message))
        .finally(() => setTrendingLoading(false));
    }
  }, [apiKey, isLoaded, isSearchFocused, trending.length]);

  // Restore scroll position when returning from details page
  useEffect(() => {
    const savedScroll = sessionStorage.getItem('void_home_scroll');
    if (savedScroll) {
      sessionStorage.removeItem('void_home_scroll');
      requestAnimationFrame(() => {
        window.scrollTo(0, parseInt(savedScroll, 10));
      });
    }
  }, []);

  // Cleanup abort controller on unmount
  useEffect(() => {
    // Set default theme color for Home
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#030712'); // gray-950

    return () => {
      if (searchAbortController.current) {
        searchAbortController.current.abort();
      }
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, []);

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery || searchQuery.trim().length < 2 || !apiKey) {
      if (searchAbortController.current) {
        searchAbortController.current.abort();
      }
      setSearchResults([]);
      return;
    }

    // Cancel any pending search
    if (searchAbortController.current) {
      searchAbortController.current.abort();
    }
    searchAbortController.current = new AbortController();

    setSearchLoading(true);
    try {
      const results = await searchMedia(searchQuery, apiKey, searchAbortController.current.signal);
      // Remove manual sort to rely on TMDB native relevance
      setSearchResults(results);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error("Search error:", err);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch(query);
    }
  };

  if (!isLoaded) return null;

  if (!apiKey) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-full mb-6">
          <Settings size={48} className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Welcome to Void</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          To get started and browse movies, please add your TMDB API key in settings.
        </p>
        <button 
          onClick={onGoToSettings}
          className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
        >
          Go to Settings
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-2 pt-4 pb-[160px] relative">
      {/* Search field at top — visible when search is open */}
      {isSearchFocused && (
        <div className="relative w-full z-20 mb-6 mt-2">
          <SearchIcon
            className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-cyan scale-110 transition-all duration-300"
            size={22}
          />
          <input
            type="text"
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search movies, shows..."
            className="w-full pl-12 pr-20 bg-brand-bg blueprint-border rounded-2xl transition-all duration-300 outline-none font-medium text-white placeholder:text-brand-silver/50 py-5 text-lg shadow-[0_0_30px_rgba(34,211,238,0.15)] ring-1 ring-brand-cyan/30"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {query.trim().length >= 2 && (
              <button
                onClick={() => handleSearch(query)}
                className="p-2 bg-brand-cyan text-brand-bg rounded-xl shadow-lg hover:bg-brand-cyan/80 transition-all active:scale-95"
                title="Search"
              >
                <ArrowRight size={16} />
              </button>
            )}
            <button
              onClick={() => {
                startTransition(() => {
                  setQuery('');
                  setSearchResults([]);
                  setIsSearchFocused(false);
                  if (searchAbortController.current) {
                    searchAbortController.current.abort();
                  }
                });
              }}
              className="p-2 text-brand-silver hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {(isSearching || showTrending) && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center gap-4 w-full md:w-auto">
            <div className="flex items-center gap-2">
              {isSearching ? <SearchIcon className="text-brand-cyan" size={20} /> : <div className="w-2 h-6 bg-brand-cyan rounded-full" />}
              <h1 className="text-xl font-black italic tracking-tighter text-white uppercase">
                {isSearching ? (searchLoading ? 'Searching...' : (searchResults.length > 0 ? `Results for "${query}"` : 'Type and press Enter to search')) : 'Popular Right Now'}
              </h1>
            </div>

            {vidAngelEnabled && (
              <button
                onClick={() => {
                  startTransition(() => {
                    const newValue = !showEditedOnly;
                    setShowEditedOnly(newValue);
                    if (newValue) setShowFavoritesOnly(false);
                    showStatus(newValue ? 'Edited' : 'Showing All');
                  });
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                  showEditedOnly
                    ? 'bg-amber-500/20 text-amber-400 blueprint-border'
                    : 'bg-brand-bg/50 text-brand-silver blueprint-border'
                }`}
              >
                <ShieldCheck size={14} className={showEditedOnly ? 'fill-current' : ''} />
                EDITED
              </button>
            )}
          </div>
          {(showTrending || isSearching) && (
            <button
              onClick={() => startTransition(() => {
                setQuery('');
                setSearchResults([]);
                setIsSearchFocused(false);
                if (searchAbortController.current) {
                  searchAbortController.current.abort();
                }
              })}
              className="flex items-center gap-2 px-6 py-3 bg-brand-bg/80 blueprint-border text-brand-cyan rounded-xl font-bold hover:bg-brand-cyan/10 transition-all shadow-[0_0_15px_rgba(34,211,238,0.1)] active:scale-95 uppercase tracking-wider text-sm whitespace-nowrap"
            >
              <ArrowLeft size={18} />
              Return to Library
            </button>
          )}
        </div>
      )}

      {error && !isSearching && (
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
                  ref={index === displayMedia.length - 1 ? lastItemRef : null}
                >
                  <MediaCard
                    media={{
                      ...item,
                      isEdited: editedStatusMap[`${item.media_type}-${item.id}`]
                    }}
                    showBadge={showEditedOnly}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-brand-silver">
              {isSearching ? (
                <p className="font-medium text-lg">
                  {searchLoading ? 'Searching...' : `No results found for "${query}"`}
                </p>
              ) : showTrending ? (
                <p>No trending content found.</p>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <p className="text-lg font-medium text-white">Your list is empty</p>
                  <p className="text-sm text-brand-silver max-w-xs mx-auto">
                    Search for movies and shows to add them to your watchlist.
                  </p>
                  <button
                    onClick={() => setIsSearchFocused(true)}
                    className="mt-4 text-brand-cyan font-bold uppercase tracking-wider text-xs border-b border-brand-cyan/30 pb-1 hover:border-brand-cyan transition-colors"
                  >
                    Browse Popular
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Floating Search Button */}
      {!isSearchFocused && (
        <button
          onClick={() => startTransition(() => setIsSearchFocused(true))}
          className={clsx(
            "fixed bottom-36 right-4 z-40 w-11 h-11 bg-brand-bg/80 backdrop-blur-md blueprint-border text-brand-cyan rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.3)] flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-500 group",
            !isFooterVisible ? "translate-y-[120px]" : "translate-y-0"
          )}
          title="Search"
        >
          <SearchIcon size={20} className="group-hover:rotate-12 transition-transform" />
        </button>
      )}

      {/* Fixed Bottom Bar */}
      {!isSearchFocused && (
        <div className={clsx(
          "fixed bottom-0 left-0 right-0 z-30 bg-brand-bg/40 backdrop-blur-xl border-t border-white/[0.04] transition-transform duration-500",
          !isFooterVisible ? "translate-y-full" : "translate-y-0"
        )}>
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

          <div className="max-w-7xl mx-auto px-4 py-2 flex flex-col items-center gap-3 relative">
            {/* Row 1: Primary Navigation + Settings + Sort */}
            <div className="flex items-center justify-center w-full relative">
              {/* Settings button on the far left */}
              <div className="absolute left-0">
                <button
                  onClick={onGoToSettings}
                  className="flex items-center justify-center w-9 h-9 rounded-xl bg-brand-bg/50 blueprint-border text-brand-silver hover:text-brand-cyan transition-all"
                  title="Settings"
                >
                  <Settings size={18} />
                </button>
              </div>

              {/* Watchlist / History Tabs (Centered) */}
              <div className="flex p-1 bg-brand-bg/50 blueprint-border rounded-xl w-[240px] transition-colors duration-300">
                <button
                  onClick={() => {
                    startTransition(() => setShowWatched(false));
                    showStatus('Watchlist');
                    window.scrollTo(0, 0);
                  }}
                  className={clsx(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all",
                    !showWatched 
                      ? "bg-brand-cyan/10 text-brand-cyan shadow-[0_0_15px_rgba(34,211,238,0.1)]" 
                      : "text-brand-silver hover:text-white"
                  )}
                >
                  <Bookmark size={14} />
                  Watchlist
                </button>
                <button
                  onClick={() => {
                    startTransition(() => setShowWatched(true));
                    showStatus('Watched');
                    window.scrollTo(0, 0);
                  }}
                  className={clsx(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all",
                    showWatched 
                      ? "bg-brand-cyan/10 text-brand-cyan shadow-[0_0_15px_rgba(34,211,238,0.1)]" 
                      : "text-brand-silver hover:text-white"
                  )}
                >
                  <CheckCircle2 size={14} />
                  Watched
                </button>
              </div>

              {/* Sort Menu (Absolutely positioned to the right of the centered toggle) */}
              {showLibrary && (
                <div className="absolute right-0">
                  <button
                    onClick={() => setShowSortMenu(!showSortMenu)}
                    className={clsx(
                      "flex items-center justify-center w-9 h-9 rounded-xl transition-all",
                      showSortMenu 
                        ? "bg-brand-cyan/10 text-brand-cyan" 
                        : "bg-brand-bg/50 blueprint-border text-brand-silver hover:text-brand-cyan"
                    )}
                    title="Sort & Filter"
                  >
                    <SlidersHorizontal size={18} />
                  </button>

                  {showSortMenu && (
                    <div className="absolute bottom-full right-0 mb-2 py-2 w-48 rounded-xl bg-brand-bg blueprint-border shadow-xl z-20">
                      <button
                        onClick={() => {
                          startTransition(() => setSort('added'));
                          showStatus('Recently Added');
                          setShowSortMenu(false);
                        }}
                        className={clsx(
                          "w-full px-4 py-2 text-left text-sm font-bold flex items-center gap-2 transition-colors",
                          (sort || 'added') === 'added'
                            ? "text-brand-cyan"
                            : "text-brand-silver hover:text-white hover:bg-brand-bg/50"
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
                          "w-full px-4 py-2 text-left text-sm font-bold flex items-center gap-2 transition-colors",
                          sort === 'title'
                            ? "text-brand-cyan"
                            : "text-brand-silver hover:text-white hover:bg-brand-bg/50"
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
                          "w-full px-4 py-2 text-left text-sm font-bold flex items-center gap-2 transition-colors",
                          sort === 'release'
                            ? "text-brand-cyan"
                            : "text-brand-silver hover:text-white hover:bg-brand-bg/50"
                        )}
                      >
                        Release Date
                      </button>

                      {(vidAngelEnabled || showWatched) && <div className="h-px bg-white/5 my-1" />}

                      {showWatched && (
                        <button
                          onClick={() => {
                            startTransition(() => {
                              const newValue = !showFavoritesOnly;
                              setShowFavoritesOnly(newValue);
                              if (newValue) setShowEditedOnly(false);
                              showStatus(newValue ? 'Favorites' : 'Showing All');
                            });
                            setShowSortMenu(false);
                          }}
                          className={clsx(
                            "w-full px-4 py-2 text-left text-sm font-bold flex items-center justify-between transition-colors",
                            showFavoritesOnly
                              ? "text-red-500 bg-red-500/5"
                              : "text-brand-silver hover:text-white hover:bg-brand-bg/50"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <Heart size={16} className={showFavoritesOnly ? 'fill-current' : ''} />
                            Favorites
                          </div>
                          {showFavoritesOnly && <Check size={14} className="text-red-500" />}
                        </button>
                      )}

                      {vidAngelEnabled && (
                        <button
                          onClick={() => {
                            startTransition(() => {
                              const newValue = !showEditedOnly;
                              setShowEditedOnly(newValue);
                              if (newValue) setShowFavoritesOnly(false);
                              showStatus(newValue ? 'Edited' : 'Showing All');
                            });
                            setShowSortMenu(false);
                          }}
                          className={clsx(
                            "w-full px-4 py-2 text-left text-sm font-bold flex items-center justify-between transition-colors",
                            showEditedOnly
                              ? "text-amber-500 bg-amber-500/5"
                              : "text-brand-silver hover:text-white hover:bg-brand-bg/50"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <ShieldCheck size={16} className={showEditedOnly ? 'fill-current' : ''} />
                            Edited
                          </div>
                          {showEditedOnly && <Check size={14} className="text-amber-500" />}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Row 2: Secondary Filter (Centered) */}
            <div className="flex items-center justify-center w-full relative">
              <div className="flex items-center justify-center w-full max-w-sm">
                <FilterTabs
                  currentFilter={filter || 'movie'}
                  onFilterChange={(f) => {
                    startTransition(() => setFilter(f));
                    showStatus(f === 'movie' ? 'Movies' : 'TV Shows');
                    window.scrollTo(0, 0);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};