'use client';

import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { MediaCard } from '@/components/MediaCard';
import { List, Play } from 'lucide-react';
import { FilterTabs, FilterType } from '@/components/FilterTabs';
import { SortControl } from '@/components/SortControl';
import { SortOption, sortMedia } from '@/lib/sort';

interface WatchlistViewProps {
  onBrowse: () => void;
}

export const WatchlistView = ({ onBrowse }: WatchlistViewProps) => {
  const { watchlist } = useAppContext();
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortOption>('added');

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
