import React from 'react';
import { Clock, AlignLeft, Calendar } from 'lucide-react';
import { SortOption } from '@/lib/types';

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
  const currentIndex = SORT_OPTIONS.findIndex(o => o.value === currentSort);
  const current = SORT_OPTIONS[currentIndex];
  const nextIndex = (currentIndex + 1) % SORT_OPTIONS.length;

  const handleClick = () => {
    onSortChange(SORT_OPTIONS[nextIndex].value);
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center justify-center w-10 h-10 rounded-xl transition-all bg-brand-cyan/20 text-brand-cyan hover:bg-brand-cyan/30"
      title={current.title}
    >
      {current.icon}
    </button>
  );
};
