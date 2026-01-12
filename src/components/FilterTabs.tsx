'use client';

import React from 'react';
import { clsx } from 'clsx';
import { Film, Tv, LayoutGrid } from 'lucide-react';

export type FilterType = 'all' | 'movie' | 'tv';

interface FilterTabsProps {
  currentFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
}

export const FilterTabs: React.FC<FilterTabsProps> = ({ currentFilter, onFilterChange }) => {
  const tabs: { id: FilterType; label: string; icon: React.ElementType }[] = [
    { id: 'all', label: 'All', icon: LayoutGrid },
    { id: 'movie', label: 'Movies', icon: Film },
    { id: 'tv', label: 'Shows', icon: Tv },
  ];

  return (
    <div className="flex p-1 bg-gray-100 dark:bg-gray-900 rounded-xl w-full max-w-md transition-colors duration-300">
      {tabs.map((tab) => {
        const isActive = currentFilter === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onFilterChange(tab.id)}
            className={clsx(
              "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-bold transition-all",
              isActive 
                ? "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            )}
          >
            <Icon size={16} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};
