'use client';

import { useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { MediaCard } from '@/components/MediaCard';
import { List, Play, CalendarClock } from 'lucide-react';
import { FilterTabs, FilterType } from '@/components/FilterTabs';
import { SortControl } from '@/components/SortControl';
import { SortOption, sortMedia } from '@/lib/sort';
import { getMediaDetails } from '@/lib/tmdb';
import { Media } from '@/lib/types';

interface WatchlistViewProps {
  onBrowse: () => void;
}

export const WatchlistView = ({ onBrowse }: WatchlistViewProps) => {
  const { watchlist, watched, apiKey } = useAppContext();
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortOption>('added');
  
  const [upcomingEpisodes, setUpcomingEpisodes] = useState<Media[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(false);

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

  const filteredList = watchlist.filter(item => {
    if (filter === 'all') return true;
    return item.media_type === filter;
  });

  const sortedList = sortMedia(filteredList, sort);

  return (
    <div>
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <List className="text-indigo-600 dark:text-indigo-400" size={24} />
          <h1 className="text-2xl font-black italic tracking-tighter uppercase text-gray-900 dark:text-white">My Watchlist</h1>
        </div>
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto items-stretch md:items-center mb-6 md:mb-0">
          <FilterTabs currentFilter={filter} onFilterChange={setFilter} />
          <div className="flex justify-end">
             <SortControl currentSort={sort} onSortChange={setSort} />
          </div>
        </div>
      </header>

      {/* Upcoming Episodes Section */}
      {(upcomingLoading || upcomingEpisodes.length > 0) && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <CalendarClock className="text-indigo-600 dark:text-indigo-400" size={20} />
            <h2 className="text-lg font-bold uppercase tracking-tight text-gray-900 dark:text-white">Upcoming Episodes</h2>
          </div>
          
          {upcomingLoading ? (
            <div className="space-y-2 animate-pulse">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800/50 rounded-xl w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-1 bg-gray-50 dark:bg-gray-900/40 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-800/60">
              {upcomingEpisodes.map((show) => (
                <div key={show.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 px-4 py-3 rounded-xl hover:bg-white dark:hover:bg-gray-800/50 transition-colors group">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-gray-900 dark:text-white truncate">{show.name}</span>
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded-md flex-shrink-0">
                          S{show.next_episode_to_air?.season_number}E{show.next_episode_to_air?.episode_number}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 truncate font-medium">
                        {show.next_episode_to_air?.name}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs font-bold text-gray-400 dark:text-gray-500 whitespace-nowrap sm:text-right">
                    {new Date(show.next_episode_to_air!.air_date).toLocaleDateString(undefined, { 
                      weekday: 'short',
                      month: 'short', 
                      day: 'numeric'
                    })}
                  </div>
                </div>
              ))}
            </div>
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
          {sortedList.length === 0 ? (
             <div className="text-center py-20 text-gray-500 dark:text-gray-400">
               <p>No {filter === 'movie' ? 'Movies' : 'Shows'} in your watchlist.</p>
             </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {sortedList.map((item) => (
                <MediaCard key={`${item.media_type}-${item.id}`} media={item} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
