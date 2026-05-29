'use client';

import { useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';

export function KeyboardShortcuts() {
  const { closeAllSheets, setIsSearchFocused, activeDetailsMedia, activeActorMedia, isSearchFocused, toggleWatchlist, toggleWatched } = useAppContext();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (e.key === 'Escape' && (activeDetailsMedia || activeActorMedia || isSearchFocused)) {
        e.preventDefault();
        closeAllSheets();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        closeAllSheets();
        setIsSearchFocused(true);
        return;
      }

      if (!isInput && activeDetailsMedia) {
        if (e.key === 'w' || e.key === 'W') {
          e.preventDefault();
          toggleWatchlist(activeDetailsMedia);
          return;
        }
        if (e.key === 'e' || e.key === 'E') {
          e.preventDefault();
          toggleWatched(activeDetailsMedia);
          return;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeAllSheets, setIsSearchFocused, activeDetailsMedia, activeActorMedia, isSearchFocused, toggleWatchlist, toggleWatched]);

  return null;
}
