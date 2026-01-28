'use client';

import { useEffect, useState, useMemo, useTransition } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getTrending } from '@/lib/tmdb';
import { Media } from '@/lib/types';
import { MediaCard } from '@/components/MediaCard';
import { FilterTabs, FilterType } from '@/components/FilterTabs';
import { SortControl } from '@/components/SortControl';
import { SortOption, sortMedia } from '@/lib/sort';
import { AlertCircle, Settings, Search as SearchIcon, X, Eye, ArrowLeft } from 'lucide-react';

interface HomeViewProps {
  onGoToSettings: () => void;
}

export const HomeView = ({ onGoToSettings }: HomeViewProps) => {
  const { 
    apiKey, 
    isLoaded, 
    query, 
    setQuery, 
    searchResults, 
    searchLoading, 
    watchlist, 
    watched,
    filter,
    setFilter,
    sort,
    setSort,
    showWatched,
    setShowWatched
  } = useAppContext();
  
  // Trending State
  const [trending, setTrending] = useState<Media[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  const [error, setError] = useState<string | null>(null);

  // Fetch Trending when search is focused
  useEffect(() => {
    if (isLoaded && apiKey && isSearchFocused && trending.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Combine and process library media
  const libraryMedia = useMemo(() => {
    let combined: Media[] = [];
    
    if (showWatched) {
      // History view: Show items in 'watched' that are NOT TV shows with a next episode scheduled
      combined = watched.filter(m => {
        if (m.media_type === 'tv' && m.next_episode_to_air) return false;
        return true;
      });
    } else {
      // Watchlist view: Show items in 'watchlist' + items in 'watched' that HAVE a next episode scheduled
      combined = [...watchlist];
      watched.forEach(m => {
        if (m.media_type === 'tv' && m.next_episode_to_air) {
          // Avoid duplicates if it happens to be in both
          if (!watchlist.some(w => w.id === m.id && w.media_type === 'tv')) {
            combined.push(m);
          }
        }
      });
    }

    // Filter library by type
    combined = combined.filter(m => m.media_type === filter);

    // Sort
    return sortMedia(combined, sort);
  }, [watchlist, watched, filter, sort, showWatched]);

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

  const isSearching = query.length > 0;
  const showTrending = isSearchFocused && !isSearching;
  const showLibrary = !isSearching && !showTrending;

  const displayMedia = isSearching 
    ? searchResults 
    : (showTrending ? trending : libraryMedia);
    
  const isLoading = isSearching ? searchLoading : (showTrending ? trendingLoading : isPending);

  return (
    <div className="max-w-7xl mx-auto px-4 pb-24">
      <div className="flex flex-col items-center gap-6 mb-8 pt-4">
        <div className="flex flex-row items-center gap-4 md:gap-6 w-full">
          <button 
            onClick={() => {
              startTransition(() => {
                setQuery('');
                setIsSearchFocused(false);
              });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="shrink-0 transition-opacity hover:opacity-80"
          >
            <img src="/void/logo.png" alt="Void" className="h-12 md:h-16 w-auto object-contain dark:opacity-75" />
          </button>
          <div className="relative flex-1 w-full">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={query}
              onFocus={() => startTransition(() => setIsSearchFocused(true))}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search movies & shows..."
              className="w-full pl-11 pr-10 py-3 bg-gray-100 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm text-lg font-medium text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
            />
            {(query || isSearchFocused) && (
              <button 
                onClick={() => {
                  startTransition(() => {
                    setQuery('');
                    setIsSearchFocused(false);
                  });
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={20} />
              </button>
            )}
          </div>
          <button 
            onClick={onGoToSettings}
            className="p-3 bg-gray-100 dark:bg-gray-900 rounded-2xl text-gray-500 hover:text-indigo-600 transition-colors"
          >
            <Settings size={20} />
          </button>
        </div>
        
        {showLibrary && (
          <div className="flex flex-col items-center md:flex-row md:justify-between gap-4 w-full">
            <div className="flex items-center gap-4 overflow-x-auto pb-2 md:pb-0 no-scrollbar w-full md:w-auto">
              <FilterTabs 
                currentFilter={filter as FilterType} 
                onFilterChange={(f) => startTransition(() => {
                  setFilter(f);
                  if (f === 'movie' && sort === 'upcoming') {
                    setSort('added');
                  }
                })} 
              />
            </div>
            
            <div className="flex items-center gap-2 w-full md:w-auto justify-center md:justify-end">
              <SortControl 
                currentSort={sort as SortOption} 
                onSortChange={(s) => startTransition(() => setSort(s))} 
                hideUpcoming={filter === 'movie'}
              />
              <button
                onClick={() => startTransition(() => setShowWatched(!showWatched))}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                  showWatched 
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' 
                    : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                }`}
              >
                {showWatched && <Eye size={14} />}
                {showWatched ? 'HISTORY' : 'WATCHLIST'}
              </button>
            </div>
          </div>
        )}
      </div>

      {(isSearching || showTrending) && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-2">
            {isSearching ? <SearchIcon className="text-indigo-600 dark:text-indigo-400" size={20} /> : <div className="w-2 h-6 bg-indigo-600 rounded-full" />}
            <h1 className="text-xl font-black italic tracking-tighter text-gray-900 dark:text-white uppercase">
              {isSearching ? `Results for "${query}"` : 'Popular Right Now'}
            </h1>
          </div>
          {showTrending && (
            <button 
              onClick={() => startTransition(() => setIsSearchFocused(false))}
              className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-900 border-2 border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all shadow-md active:scale-95 uppercase tracking-wider text-sm whitespace-nowrap"
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 animate-pulse">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="aspect-[2/3] bg-gray-100 dark:bg-gray-800 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {displayMedia.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {displayMedia.map((item) => (
                <MediaCard key={`${item.media_type}-${item.id}`} media={item} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-gray-500 dark:text-gray-400">
              {isSearching ? (
                <p className="font-medium text-lg text-gray-400 dark:text-gray-600">
                   No results found for &quot;{query}&quot; in {filter === 'movie' ? 'Movies' : 'Shows'}
                </p>
              ) : showTrending ? (
                <p>No trending content found.</p>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <p className="text-lg font-medium">Your list is empty</p>
                  <p className="text-sm text-gray-400 max-w-xs mx-auto">
                    Search for movies and shows to add them to your watchlist.
                  </p>
                  <button 
                    onClick={() => setIsSearchFocused(true)}
                    className="mt-4 text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider text-xs border-b-2 border-indigo-600/20 pb-1"
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