import React from 'react';
import { ArrowUpDown } from 'lucide-react';
import { SortOption } from '@/lib/types';

interface SortControlProps {
  currentSort: SortOption;
  onSortChange: (sort: SortOption) => void;
}

export const SortControl = ({ currentSort, onSortChange }: SortControlProps) => {
  return (
    <div className="flex items-center gap-2 bg-brand-bg/50 blueprint-border rounded-lg px-3 py-2">
      <ArrowUpDown size={14} className="text-brand-silver" />
      <select
        value={currentSort}
        onChange={(e) => onSortChange(e.target.value as SortOption)}
        className="bg-transparent text-xs font-bold text-brand-silver outline-none cursor-pointer appearance-none pr-2 focus:text-brand-cyan transition-colors"
        style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
      >
        <option value="added" className="bg-brand-bg text-brand-silver">Recently Added</option>
        <option value="title" className="bg-brand-bg text-brand-silver">Title</option>
        <option value="release" className="bg-brand-bg text-brand-silver">Release Date</option>
      </select>
    </div>
  );
};
