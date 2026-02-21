'use client';

import { useEffect, useState, useMemo, useTransition, useCallback, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getTrending, searchMedia } from '@/lib/tmdb';
import { checkVidAngelAvailability } from '@/lib/vidangel';
import { Media, FilterType, SortOption } from '@/lib/types';
import { MediaCard } from '@/components/MediaCard';
import { MediaCardSkeleton } from '@/components/MediaCardSkeleton';
import { FilterTabs } from '@/components/FilterTabs';
import { SortControl } from '@/components/SortControl';
import { sortMedia } from '@/lib/sort';
import { AlertCircle, Settings, Search as SearchIcon, X, Eye, ArrowLeft, ArrowRight, ShieldCheck, Bookmark, CheckCircle2, Heart } from 'lucide-react';
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
  
  // Trending State
  const [trending, setTrending] = useState<Media[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  
  // Local Search State
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Media[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchAbortController = useRef<AbortController | null>(null);
  
  const [error, setError] = useState<string | null>(null);

  // Pagination for library
  const [visibleItemsCount, setVisibleItemsCount] = useState(24);
  const itemsPerPage = 24;
  const observer = useRef<IntersectionObserver | null>(null);

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

  // Reset Edited filter when switching views or searching
  useEffect(() => {
    setShowEditedOnly(false);
  }, [isSearchFocused, query, setShowEditedOnly]);

  // Reset favorites filter when leaving watched view
  useEffect(() => {
    if (!showWatched) {
      setShowFavoritesOnly(false);
    }
  }, [showWatched, setShowFavoritesOnly]);

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

    if (showFavoritesOnly && showWatched) {
      filtered = filtered.filter(m => m.isFavorite);
    }

    return sortMedia(filtered, (sort || 'added'));
  }, [baseLibraryMedia, sort, showEditedOnly, editedStatusMap, showFavoritesOnly, showWatched]);

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

  const isSearching = searchResults.length > 0 || searchLoading || (query.length > 0 && isSearchFocused);
  const showTrending = isSearchFocused && searchResults.length === 0 && !searchLoading;
  const showLibrary = !isSearchFocused && query.length === 0;

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

  return (
    <div className="max-w-7xl mx-auto px-4 pb-24 relative">
      <div className="flex flex-col gap-6 mb-8 pt-6">
        <div className="flex flex-col gap-4 w-full">
          {/* Top Row: Search (Expands) */}
          <div className="relative w-full z-20">
            <SearchIcon 
              className={clsx(
                "absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-300",
                isSearchFocused ? "text-brand-cyan scale-110" : "text-brand-silver"
              )} 
              size={isSearchFocused ? 22 : 18} 
            />
            <input
              type="text"
              value={query}
              onFocus={() => startTransition(() => setIsSearchFocused(true))}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search movies, shows..."
              className={clsx(
                "w-full pl-12 pr-20 bg-brand-bg blueprint-border rounded-2xl transition-all duration-300 outline-none font-medium text-white placeholder:text-brand-silver/50",
                isSearchFocused 
                  ? "py-5 text-lg shadow-[0_0_30px_rgba(34,211,238,0.15)] ring-1 ring-brand-cyan/30" 
                  : "py-3 text-sm shadow-sm"
              )}
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
              {(query || isSearchFocused) && (
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
              )}
            </div>
          </div>

          {/* Bottom Row: Filter Tabs & Controls */}
          <div className={clsx(
            "flex flex-col items-center gap-4 transition-all duration-300",
            isSearchFocused ? "opacity-0 -translate-y-2 pointer-events-none h-0 overflow-hidden" : "opacity-100 translate-y-0 h-auto"
          )}>
            <div className="w-full max-w-sm">
              <FilterTabs 
                currentFilter={filter || 'movie'} 
                onFilterChange={(f) => startTransition(() => {
                  setFilter(f);
                })} 
              />
            </div>

            <div className="flex items-center gap-2 glass-effect p-1 rounded-2xl">
              {vidAngelEnabled && (
                <button
                  onClick={() => startTransition(() => setShowEditedOnly(!showEditedOnly))}
                  className={clsx(
                    "flex items-center justify-center w-10 h-10 rounded-xl transition-all",
                    showEditedOnly 
                      ? 'bg-amber-500 text-white shadow-lg' 
                      : 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
                  )}
                  title="Edited Only"
                >
                  <ShieldCheck size={20} className={showEditedOnly ? 'fill-current' : ''} />
                </button>
              )}
              
              <div className="w-px h-5 bg-white/5 mx-0.5" />

              <div className="px-1">
                <SortControl 
                  currentSort={sort || 'added'} 
                  onSortChange={(s) => startTransition(() => setSort(s))} 
                />
              </div>

              <div className="w-px h-5 bg-white/5 mx-0.5" />

              <button
                onClick={() => startTransition(() => {
                  setShowWatched(!showWatched);
                })}
                className={clsx(
                  "flex items-center justify-center w-10 h-10 rounded-xl transition-all",
                  showWatched
                    ? 'bg-green-500/20 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.15)]'
                    : 'bg-brand-cyan/10 text-brand-cyan hover:bg-brand-cyan/20'
                )}
                title={showWatched ? "Switch to Watchlist" : "Switch to History"}
              >
                {showWatched ? <CheckCircle2 size={20} /> : <Bookmark size={20} />}
              </button>

              {showWatched && (
                <button
                  onClick={() => startTransition(() => setShowFavoritesOnly(!showFavoritesOnly))}
                  className={clsx(
                    "flex items-center justify-center w-10 h-10 rounded-xl transition-all",
                    showFavoritesOnly
                      ? 'bg-red-500/20 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.15)]'
                      : 'text-brand-silver hover:text-red-400 hover:bg-white/5'
                  )}
                  title={showFavoritesOnly ? "Show all watched" : "Show favorites only"}
                >
                  <Heart size={20} className={showFavoritesOnly ? 'fill-current' : ''} />
                </button>
              )}

              <div className="w-px h-5 bg-white/5 mx-0.5" />

              <button
                onClick={onGoToSettings}
                className="flex items-center justify-center w-10 h-10 rounded-xl text-brand-silver hover:text-brand-cyan hover:bg-white/5 transition-all"
                title="Settings"
              >
                <Settings size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

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
                onClick={() => startTransition(() => setShowEditedOnly(!showEditedOnly))}
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => (
            <MediaCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          {displayMedia.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
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
    </div>
  );
};