'use client';

import { useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { MediaCard } from '@/components/MediaCard';
import { CheckCircle, Trophy, Sparkles, ArrowLeft, Loader2, CalendarClock } from 'lucide-react';
import Link from 'next/link';
import { FilterTabs, FilterType } from '@/components/FilterTabs';
import { SortControl } from '@/components/SortControl';
import { SortOption, sortMedia } from '@/lib/sort';
import { getRecommendations, getMediaDetails } from '@/lib/tmdb';
import { Media } from '@/lib/types';
import { clsx } from 'clsx';

export default function WatchedPage() {
  const { watched, watchlist, apiKey } = useAppContext();
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortOption>('added');
  
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [recommendations, setRecommendations] = useState<Media[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  
  const [upcomingEpisodes, setUpcomingEpisodes] = useState<Media[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(false);

  // Fetch upcoming episodes for watched TV shows
  useEffect(() => {
    const fetchUpcoming = async () => {
      if (!apiKey || watched.length === 0) return;
      
      const tvShows = watched.filter(item => item.media_type === 'tv');
      if (tvShows.length === 0) return;
      
      setUpcomingLoading(true);
      try {
        const promises = tvShows.map(show => getMediaDetails(show.id, 'tv', apiKey));
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
  }, [watched, apiKey]);


  const filteredList = watched.filter(item => {
    if (filter === 'all') return true;
    return item.media_type === filter;
  });

  const sortedList = sortMedia(filteredList, sort);

  const fetchRecommendations = async () => {
    if (!apiKey || watched.length === 0) return;
    
    setRecommendationsLoading(true);
    setShowRecommendations(true);
    
    try {
      const candidates = filteredList.length > 0 ? filteredList : watched;
      const shuffled = [...candidates].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 3);

      const promises = selected.map(item => getRecommendations(item.id, item.media_type, apiKey));
      const results = await Promise.all(promises);
      
      const allRecs = results.flat();
      const uniqueRecs = allRecs.filter((media, index, self) => 
        index === self.findIndex((m) => (
          m.id === media.id && (m.media_type || selected[0].media_type) === (media.media_type || selected[0].media_type)
        ))
      );

      const newRecs = uniqueRecs.filter(rec => {
        const type = rec.media_type || 'movie';
        const isWatched = watched.some(w => w.id === rec.id && w.media_type === type);
        const isWatchlist = watchlist.some(w => w.id === rec.id && w.media_type === type);
        return !isWatched && !isWatchlist;
      });
      
      const sanitizedRecs = newRecs.map(r => ({
        ...r,
        media_type: r.media_type || 'movie'
      })) as Media[];

      setRecommendations(sanitizedRecs);
    } catch (error) {
      console.error("Failed to fetch recommendations", error);
    } finally {
      setRecommendationsLoading(false);
    }
  };

  return (
    <div className="p-4">
      {/* Header Area */}
      <header className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
        <div className="flex items-center justify-between md:justify-start w-full md:w-auto">
          <div className="flex items-center gap-2">
            {showRecommendations ? (
              <Sparkles className="text-amber-500" size={24} />
            ) : (
              <CheckCircle className="text-green-600 dark:text-green-500" size={24} />
            )}
            <h1 className="text-2xl font-black italic tracking-tighter uppercase text-gray-900 dark:text-white">
              {showRecommendations ? 'For You' : 'Watched'}
            </h1>
          </div>

          {showRecommendations && (
             <button 
              onClick={() => setShowRecommendations(false)}
              className="md:hidden text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <ArrowLeft size={14} /> Back
            </button>
          )}
        </div>
        
        <div className="flex flex-col items-stretch md:items-end gap-3 w-full md:w-auto">
          {showRecommendations ? (
            <button 
              onClick={() => setShowRecommendations(false)}
              className="hidden md:flex text-sm font-bold text-gray-500 dark:text-gray-400 items-center gap-2 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <ArrowLeft size={16} /> Back to History
            </button>
          ) : (
            <>
              <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-end w-full">
                <FilterTabs currentFilter={filter} onFilterChange={setFilter} />
                <div className="flex justify-end">
                  <SortControl currentSort={sort} onSortChange={setSort} />
                </div>
              </div>
              {watched.length > 0 && (
                <button
                  onClick={fetchRecommendations}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center justify-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 rounded-xl border border-indigo-100 dark:border-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors md:self-end"
                >
                  <Sparkles size={14} />
                  Recommend
                </button>
              )}
            </>
          )}
        </div>
      </header>

      {showRecommendations ? (
        // Recommendations View
        <>
          {recommendationsLoading ? (
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-pulse">
               {[...Array(10)].map((_, i) => (
                 <div key={i} className="aspect-[2/3] bg-gray-100 dark:bg-gray-800 rounded-xl" />
               ))}
             </div>
          ) : recommendations.length === 0 ? (
             <div className="text-center py-20">
               <p className="text-gray-500 dark:text-gray-400">No recommendations found based on your history.</p>
             </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {recommendations.map((item) => (
                <MediaCard key={`${item.media_type}-${item.id}`} media={item} />
              ))}
            </div>
          )}
        </>
      ) : (
        // Watched List View
        <>
           {/* Upcoming Episodes Section */}
          {upcomingEpisodes.length > 0 && (
            <section className="mb-10">
              <div className="flex items-center gap-2 mb-4">
                <CalendarClock className="text-indigo-600 dark:text-indigo-400" size={20} />
                <h2 className="text-lg font-bold uppercase tracking-tight text-gray-900 dark:text-white">Upcoming Episodes</h2>
              </div>
              
              <div className="flex overflow-x-auto pb-4 gap-4 -mx-4 px-4 snap-x hide-scrollbar">
                {upcomingEpisodes.map((item) => (
                  <div key={item.id} className="w-[160px] flex-shrink-0 snap-center">
                    <MediaCard media={item} showActions={false} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {watched.length === 0 ? (
            <div className="text-center py-20 px-6">
              <div className="bg-gray-100 dark:bg-gray-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trophy className="text-gray-300 dark:text-gray-600" size={32} />
              </div>
              <h2 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">No History</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-8">Mark some movies as watched to see them here.</p>
              <Link 
                href="/"
                className="inline-block bg-green-600 dark:bg-green-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-green-700 dark:hover:bg-green-500 transition-colors"
              >
                Browse trending
              </Link>
            </div>
          ) : (
            <>
              {sortedList.length === 0 ? (
                 <div className="text-center py-20 text-gray-500 dark:text-gray-400">
                   <p>No {filter === 'movie' ? 'Movies' : 'Shows'} in your watched history.</p>
                 </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle className="text-indigo-600 dark:text-indigo-400" size={20} />
                    <h2 className="text-lg font-bold uppercase tracking-tight text-gray-900 dark:text-white">Watch History</h2>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {sortedList.map((item) => (
                      <MediaCard key={`${item.media_type}-${item.id}`} media={item} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}