import React from 'react';
import { Clock } from 'lucide-react';
import { SortOption } from '@/lib/types';

interface SortControlProps {
  currentSort: SortOption;
  onSortChange: (sort: SortOption) => void;
}

export const SortControl = ({ currentSort, onSortChange }: SortControlProps) => {
  return (
    <button
      onClick={() => onSortChange('added')}
      className="flex items-center justify-center w-10 h-10 rounded-xl transition-all bg-brand-cyan/20 text-brand-cyan hover:bg-brand-cyan/30"
      title={currentSort === 'added' ? 'Recently Added' : 'Recently Added'}
    >
      <Clock size={16} />
    </button>
  );
};
