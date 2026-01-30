'use client';

import React from 'react';
import { clsx } from 'clsx';
import { Film, Tv } from 'lucide-react';
import { FilterType } from '@/lib/types';

interface FilterTabsProps {
  currentFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
}

export const FilterTabs: React.FC<FilterTabsProps> = ({ currentFilter, onFilterChange }) => {
  const tabs: { id: FilterType; label: string; icon: React.ElementType }[] = [
    { id: 'movie', label: 'Movies', icon: Film },
    { id: 'tv', label: 'Shows', icon: Tv },
  ];

  return (
    <div className="flex p-1 bg-brand-bg/50 blueprint-border rounded-xl w-full max-w-md transition-colors duration-300">
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
                ? "bg-brand-cyan/10 text-brand-cyan shadow-[0_0_15px_rgba(34,211,238,0.1)]" 
                : "text-brand-silver hover:text-white"
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
