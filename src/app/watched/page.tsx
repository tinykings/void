'use client';

import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { MediaCard } from '@/components/MediaCard';
import { CheckCircle, Trophy, Sparkles, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { FilterTabs, FilterType } from '@/components/FilterTabs';
import { getRecommendations } from '@/lib/tmdb';
import { Media } from '@/lib/types';

export default function WatchedPage() {
  const { watched, watchlist, apiKey } = useAppContext();
  const [filter, setFilter] = useState<FilterType>('all');
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [recommendations, setRecommendations] = useState<Media[]>([]);
  const [loading, setLoading] = useState(false);

  const filteredList = watched.filter(item => {
    if (filter === 'all') return true;
    return item.media_type === filter;
  });

  const fetchRecommendations = async () => {
    if (!apiKey || watched.length === 0) return;
    
    setLoading(true);
    setShowRecommendations(true);
    
    try {
      // Pick up to 3 random items from watched history to base recommendations on
      // Prefer items that match the current filter if set
      const candidates = filteredList.length > 0 ? filteredList : watched;
      const shuffled = [...candidates].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 3);

      const promises = selected.map(item => getRecommendations(item.id, item.media_type, apiKey));
      const results = await Promise.all(promises);
      
      // Flatten and deduplicate
      const allRecs = results.flat();
      const uniqueRecs = allRecs.filter((media, index, self) => 
        index === self.findIndex((m) => (
          m.id === media.id && (m.media_type || selected[0].media_type) === (media.media_type || selected[0].media_type)
        ))
      );

      // Filter out items already watched or in watchlist
      const newRecs = uniqueRecs.filter(rec => {
        const type = rec.media_type || 'movie'; // Default assumption if missing
        const isWatched = watched.some(w => w.id === rec.id && w.media_type === type);
        const isWatchlist = watchlist.some(w => w.id === rec.id && w.media_type === type);
        return !isWatched && !isWatchlist;
      });
      
      // Ensure media_type is present (API sometimes omits it for known endpoints)
      const sanitizedRecs = newRecs.map(r => ({
        ...r,
        media_type: r.media_type || 'movie'
      })) as Media[];

      setRecommendations(sanitizedRecs);
    } catch (error) {
      console.error("Failed to fetch recommendations", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
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
        
        {!showRecommendations && (
           <div className="w-full md:w-auto">
             <FilterTabs currentFilter={filter} onFilterChange={setFilter} />
           </div>
        )}
      </header>

      {/* Recommendations Button / Back Button */}
      {watched.length > 0 && (
        <div className="mb-8">
          {showRecommendations ? (
            <button 
              onClick={() => setShowRecommendations(false)}
              className="flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <ArrowLeft size={16} /> Back to History
            </button>
          ) : (
            <button
              onClick={fetchRecommendations}
              className="w-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors border border-indigo-100 dark:border-indigo-900/30"
            >
              <Sparkles size={18} />
              Get Recommendations
            </button>
          )}
        </div>
      )}

      {showRecommendations ? (
        // Recommendations View
        <>
          {loading ? (
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
              {filteredList.length === 0 ? (
                 <div className="text-center py-20 text-gray-500 dark:text-gray-400">
                   <p>No {filter === 'movie' ? 'Movies' : 'Shows'} in your watched history.</p>
                 </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {filteredList.map((item) => (
                    <MediaCard key={`${item.media_type}-${item.id}`} media={item} />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
