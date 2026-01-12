'use client';

import { ArrowUpDown } from 'lucide-react';
import { SortOption } from '@/lib/sort';

interface SortControlProps {
  currentSort: SortOption;
  onSortChange: (sort: SortOption) => void;
}

export const SortControl = ({ currentSort, onSortChange }: SortControlProps) => {
  return (
    <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-900 rounded-lg px-3 py-2">
      <ArrowUpDown size={14} className="text-gray-400" />
      <select
        value={currentSort}
        onChange={(e) => onSortChange(e.target.value as SortOption)}
        className="bg-transparent text-xs font-bold text-gray-600 dark:text-gray-300 outline-none cursor-pointer appearance-none pr-2"
        style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
      >
        <option value="added">Recently Added</option>
        <option value="title">Title</option>
        <option value="release">Release Date</option>
      </select>
    </div>
  );
};
