'use client';

import { useEffect, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getTrending, searchMedia } from '@/lib/tmdb';
import { Media } from '@/lib/types';
import { MediaCard } from '@/components/MediaCard';
import { FilterTabs, FilterType } from '@/components/FilterTabs';
import { TrendingUp, AlertCircle, Settings, Search as SearchIcon, X } from 'lucide-react';

interface HomeViewProps {
  onGoToSettings: () => void;
}

export const HomeView = ({ onGoToSettings }: HomeViewProps) => {
  const { apiKey, isLoaded } = useAppContext();
  
  // Trending State
  const [trending, setTrending] = useState<Media[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  
  // Search State
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Media[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');

  // Fetch Trending
  useEffect(() => {
    if (isLoaded && apiKey && !query) {
      setTrendingLoading(true);
      getTrending(apiKey, filter)
        .then((items) => {
          const processed = items.map(item => ({
            ...item,
            media_type: item.media_type || (filter === 'movie' ? 'movie' : filter === 'tv' ? 'tv' : 'movie')
          })) as Media[];
          setTrending(processed);
        })
        .catch((err) => setError(err.message))
        .finally(() => setTrendingLoading(false));
    }
  }, [apiKey, isLoaded, filter, query]);

  // Debounced Search
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (query.length > 2 && apiKey) {
        setSearchLoading(true);
        searchMedia(query, apiKey)
          .then((results) => {
            // Sort by popularity at the top
            const sorted = [...results].sort((a, b) => b.popularity - a.popularity);
            
            // Apply current filter to search results if not 'all'
            const filtered = sorted.filter(item => {
              if (filter === 'all') return true;
              return item.media_type === filter;
            });
            setSearchResults(filtered);
          })
          .catch(console.error)
          .finally(() => setSearchLoading(false));
      } else if (query.length === 0) {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [query, apiKey, filter]);

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
  const displayMedia = isSearching ? searchResults : trending;
  const isLoading = isSearching ? searchLoading : trendingLoading;

  return (
    <div className="max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          {isSearching ? (
             <SearchIcon className="text-indigo-600 dark:text-indigo-400" size={24} />
          ) : (
            <TrendingUp className="text-indigo-600 dark:text-indigo-400" size={24} />
          )}
          <h1 className="text-2xl font-black italic tracking-tighter text-gray-900 dark:text-white uppercase">
            {isSearching ? `Search Results` : `Trending This Week`}
          </h1>
        </div>
        <div className="w-full md:w-auto mb-6 md:mb-0">
          <FilterTabs currentFilter={filter} onFilterChange={setFilter} />
        </div>
      </header>

      {/* Search Bar - Under Filter Tabs */}
      <div className="relative mb-8 w-full max-w-md mx-auto">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search movies & shows..."
          className="w-full pl-11 pr-10 py-3 bg-gray-100 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm text-base font-medium text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
        />
        {query && (
          <button 
            onClick={() => setQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X size={18} />
          </button>
        )}
      </div>

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
                   No results found for &quot;{query}&quot;
                   {filter !== 'all' && ` in ${filter === 'movie' ? 'Movies' : 'Shows'}`}
                </p>
              ) : (
                <p>No trending content found.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
