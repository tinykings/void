import React from 'react';
import { Clock, AlignLeft, Calendar } from 'lucide-react';
import { SortOption } from '@/lib/types';
import { clsx } from 'clsx';

interface SortControlProps {
  currentSort: SortOption;
  onSortChange: (sort: SortOption) => void;
}

const SORT_OPTIONS: { value: SortOption; icon: React.ReactNode; title: string }[] = [
  { value: 'added',   icon: <Clock size={16} />,     title: 'Recently Added' },
  { value: 'title',   icon: <AlignLeft size={16} />, title: 'Title (A–Z)' },
  { value: 'release', icon: <Calendar size={16} />,  title: 'Release Date' },
];

export const SortControl = ({ currentSort, onSortChange }: SortControlProps) => {
  return (
    <>
      {SORT_OPTIONS.map(({ value, icon, title }) => (
        <button
          key={value}
          onClick={() => onSortChange(value)}
          className={clsx(
            "flex items-center justify-center w-10 h-10 rounded-xl transition-all",
            currentSort === value
              ? 'bg-brand-cyan/20 text-brand-cyan'
              : 'text-brand-silver hover:text-white hover:bg-white/5'
          )}
          title={title}
        >
          {icon}
        </button>
      ))}
    </>
  );
};
