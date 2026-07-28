'use client';

import { useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getDetailsKeyboardAction, triggerDetailsAction } from '@/lib/keyboard';

export function KeyboardShortcuts() {
  const { closeAllSheets, setIsSearchFocused, activeDetailsMedia, activeActorMedia, isSearchFocused } = useAppContext();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTextEntry = !!target.closest('input, textarea, select, [contenteditable="true"]');

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

      if (!isTextEntry && activeDetailsMedia && !document.querySelector('[data-block-details-shortcuts="true"]')) {
        const action = getDetailsKeyboardAction(e.key);
        if (action && triggerDetailsAction(action)) {
          e.preventDefault();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeAllSheets, setIsSearchFocused, activeDetailsMedia, activeActorMedia, isSearchFocused]);

  return null;
}
