'use client';

import { useState, useEffect, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';
import { MediaCard } from '@/components/MediaCard';
import { List, Play, CalendarClock, ChevronDown, ChevronUp, Search as SearchIcon, X } from 'lucide-react';
import { FilterTabs, FilterType } from '@/components/FilterTabs';
import { SortControl } from '@/components/SortControl';
import { SortOption, sortMedia } from '@/lib/sort';
import { getMediaDetails } from '@/lib/tmdb';
import { Media } from '@/lib/types';

interface WatchlistViewProps {
  onBrowse: () => void;
}

export const WatchlistView = ({ onBrowse }: WatchlistViewProps) => {
  const { watchlist, watched, apiKey, query, setQuery, searchResults, searchLoading } = useAppContext();
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortOption>('added');
  
  const [upcomingEpisodes, setUpcomingEpisodes] = useState<Media[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(false);
  const [isUpcomingExpanded, setIsUpcomingExpanded] = useState(true);

  const [visibleCount, setVisibleCount] = useState(20);
  const observerTarget = useRef<HTMLDivElement>(null);

  const filteredList = watchlist.filter(item => {
    if (filter === 'all') return true;
    return item.media_type === filter;
  });

  const sortedList = sortMedia(filteredList, sort);
  const visibleList = sortedList.slice(0, visibleCount);

  const isSearching = query.length > 0;
  
  const filteredSearchResults = searchResults.filter(item => {
    if (filter === 'all') return true;
    return item.media_type === filter;
  });

  useEffect(() => {
    setVisibleCount(20);
  }, [filter, sort, watchlist]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + 20);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [sortedList.length]); // Re-attach if list length changes significantly, though target ref is stable

  // Fetch upcoming episodes for both watched and watchlist TV shows
  useEffect(() => {
    const fetchUpcoming = async () => {
      if (!apiKey || (watched.length === 0 && watchlist.length === 0)) return;
      
      const allMedia = [...watched, ...watchlist];
      const tvShows = allMedia.filter(item => item.media_type === 'tv');
      
      // De-duplicate by ID
      const uniqueTvShows = Array.from(new Map(tvShows.map(item => [item.id, item])).values());
      
      if (uniqueTvShows.length === 0) return;
      
      setUpcomingLoading(true);
      try {
        const promises = uniqueTvShows.map(show => getMediaDetails(show.id, 'tv', apiKey));
        const results = await Promise.all(promises);
        
        const withUpcoming = results
          .filter(show => show.next_episode_to_air)
          .sort((a, b) => {
             const dateA = new Date(a.next_episode_to_air!.air_date).getTime();
             const dateB = new Date(b.next_episode_to_air!.air_date).getTime();
             return dateA - dateB;
          });

        setUpcomingEpisodes(withUpcoming);
      } catch (e) {
        console.error("Failed to fetch upcoming episodes", e);
      } finally {
        setUpcomingLoading(false);
      }
    };

    fetchUpcoming();
  }, [watched, watchlist, apiKey]);



  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col items-center gap-6 mb-10">
        <div className="flex flex-row items-center gap-4 md:gap-6 w-full">
          <img src="/logo.png" alt="Void" className="h-16 md:h-24 w-auto object-contain shrink-0 dark:invert dark:opacity-75" />
          <div className="relative flex-1 w-full">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search movies & shows..."
              className="w-full pl-11 pr-10 py-4 bg-gray-100 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm text-lg font-medium text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
            />
            {query && (
              <button 
                onClick={() => setQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>
        
        <div className="flex flex-col items-center gap-4 w-full">
          {isSearching && (
            <div className="flex items-center gap-2 mb-2">
               <SearchIcon className="text-indigo-600 dark:text-indigo-400" size={20} />
               <h1 className="text-xl font-black italic tracking-tighter text-gray-900 dark:text-white uppercase">
                 Search Results
               </h1>
            </div>
          )}
          <FilterTabs currentFilter={filter} onFilterChange={setFilter} />
        </div>
      </div>

      {isSearching ? (
        <>
          {searchLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 animate-pulse">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="aspect-[2/3] bg-gray-100 dark:bg-gray-800 rounded-xl" />
              ))}
            </div>
          ) : (
            <>
              {filteredSearchResults.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {filteredSearchResults.map((item) => (
                    <MediaCard key={`${item.media_type}-${item.id}`} media={item} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 text-gray-500 dark:text-gray-400">
                  <p className="font-medium text-lg text-gray-400 dark:text-gray-600">
                     No results found for &quot;{query}&quot;
                  </p>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <>
          {/* Upcoming Episodes Section */}
          {filter !== 'movie' && (upcomingLoading || upcomingEpisodes.length > 0) && (
            <section className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CalendarClock className="text-indigo-600 dark:text-indigo-400" size={20} />
                  <h2 className="text-lg font-bold uppercase tracking-tight text-gray-900 dark:text-white">Upcoming Episodes</h2>
                </div>
                <button 
                  onClick={() => setIsUpcomingExpanded(!isUpcomingExpanded)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400"
                  aria-label={isUpcomingExpanded ? "Collapse" : "Expand"}
                >
                  {isUpcomingExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
              </div>
              
              {isUpcomingExpanded && (
                <>
                  {upcomingLoading ? (
                    <div className="space-y-2 animate-pulse">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800/50 rounded-xl w-full" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-0.5 bg-gray-50 dark:bg-gray-900/40 p-1 rounded-xl border border-gray-100 dark:border-gray-800/60">
                      {upcomingEpisodes.map((show) => (
                        <div key={show.id} className="flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-white dark:hover:bg-gray-800/50 transition-colors group text-sm">
                          <span className="font-bold text-gray-900 dark:text-white truncate">
                            {show.name}
                          </span>
                          
                          <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap flex-shrink-0">
                            {new Date(show.next_episode_to_air!.air_date).toLocaleDateString(undefined, { 
                              month: 'short', 
                              day: 'numeric'
                            })}
                          </span>

                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="flex-shrink-0 text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded-md">
                               S{show.next_episode_to_air?.season_number}E{show.next_episode_to_air?.episode_number}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400 truncate">
                              {show.next_episode_to_air?.name}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {watchlist.length === 0 ? (
            <div className="text-center py-20 px-6">
              <div className="bg-gray-100 dark:bg-gray-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Play className="text-gray-300 dark:text-gray-600 ml-1" size={32} />
              </div>
              <h2 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">Empty List</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-8">You haven&apos;t added anything to your watchlist yet.</p>
              <button 
                onClick={onBrowse}
                className="inline-block bg-indigo-600 dark:bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 dark:hover:bg-indigo-500 transition-colors"
              >
                Find something to watch
              </button>
            </div>
          ) : (
            <>
              <div className="flex justify-end mb-4">
                 <SortControl currentSort={sort} onSortChange={setSort} />
              </div>
              {sortedList.length === 0 ? (
                 <div className="text-center py-20 text-gray-500 dark:text-gray-400">
                   <p>No {filter === 'movie' ? 'Movies' : 'Shows'} in your watchlist.</p>
                 </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {visibleList.map((item) => (
                    <MediaCard key={`${item.media_type}-${item.id}`} media={item} />
                  ))}
                  {visibleList.length < sortedList.length && (
                    <div ref={observerTarget} className="col-span-full h-10 w-full flex items-center justify-center p-4">
                      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};
