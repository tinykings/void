'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { Media, UserState, SortOption, FilterType } from '@/lib/types';
import { useStore } from '@/store/useStore';

interface AppContextType extends UserState {
  setApiKey: (key: string) => void;
  setGistId: (id: string) => void;
  setGistToken: (token: string) => void;
  setVidAngelEnabled: (enabled: boolean) => void;
  toggleWatchlist: (media: Media) => void;
  toggleWatched: (media: Media, rating?: number) => void;
  isLoaded: boolean;

  setFilter: (filter: FilterType) => void;
  setSort: (sort: SortOption) => void;
  setShowWatched: (show: boolean) => void;
  setShowEditedOnly: (show: boolean) => void;
  showFavoritesOnly: boolean;
  setShowFavoritesOnly: (show: boolean) => void;
  toggleFavorite: (media: Media) => void;
  updateMediaMetadata: (id: number, type: 'movie' | 'tv', metadata: Partial<Media>) => void;
  setMediaEditedStatus: (id: number, type: 'movie' | 'tv', isEdited: boolean) => void;
  onboardingCompleted: boolean;
  setOnboardingCompleted: (completed: boolean) => void;
  isSearchFocused: boolean;
  setIsSearchFocused: (focused: boolean) => void;
  syncFromGist: () => Promise<void>;

  // Episode tracking
  markEpisodePlayed: (tmdbId: number, seasonNum: number, episodeNum: number) => void;
  unmarkEpisodePlayed: (tmdbId: number, seasonNum: number, episodeNum: number) => void;

  // O(1) lookup helpers
  watchlistIds: Set<string>;
  watchedIds: Set<string>;
  watchedMap: Map<string, Media>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const store = useStore();
  const initialGistSyncDone = useRef('');

  // Service worker registration
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      const registerServiceWorker = async () => {
        try {
          await navigator.serviceWorker.register('/void/sw.js');
        } catch (error) {
          console.error('Service worker registration failed:', error);
        }
      };
      registerServiceWorker();
    }
  }, []);

  useEffect(() => {
    if (!store.isLoaded || !store.gistId || !store.gistToken) {
      initialGistSyncDone.current = '';
      return;
    }

    const signature = `${store.gistId}:${store.gistToken}`;
    if (initialGistSyncDone.current === signature) return;

    initialGistSyncDone.current = signature;
    void store.syncFromGist();
  }, [store.isLoaded, store.gistId, store.gistToken, store.syncFromGist]);

  // O(1) lookup Maps for membership checks
  const watchlistIds = useMemo(() => new Set(store.watchlist.map(m => `${m.media_type}-${m.id}`)), [store.watchlist]);
  const watchedIds = useMemo(() => new Set(store.watched.map(m => `${m.media_type}-${m.id}`)), [store.watched]);
  const watchedMap = useMemo(() => {
    const map = new Map<string, Media>();
    store.watched.forEach(m => map.set(`${m.media_type}-${m.id}`, m));
    return map;
  }, [store.watched]);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo<AppContextType>(() => ({
    apiKey: store.apiKey,
    gistId: store.gistId,
    gistToken: store.gistToken,
    watchlist: store.watchlist,
    watched: store.watched,
    vidAngelEnabled: store.vidAngelEnabled || false,
    filter: store.filter,
    sort: store.sort,
    showWatched: store.showWatched || false,
    showEditedOnly: store.showEditedOnly || false,
    showFavoritesOnly: store.showFavoritesOnly || false,
    isSearchFocused: store.isSearchFocused || false,
    editedStatusMap: store.editedStatusMap,
    playedEpisodes: store.playedEpisodes,
    isLoaded: store.isLoaded,
    
    setApiKey: store.setApiKey,
    setGistId: store.setGistId,
    setGistToken: store.setGistToken,
    setVidAngelEnabled: store.setVidAngelEnabled,
    toggleWatchlist: store.toggleWatchlist,
    toggleWatched: store.toggleWatched,
    syncFromGist: store.syncFromGist,
    setFilter: store.setFilter,
    setSort: store.setSort,
    setShowWatched: store.setShowWatched,
    setShowEditedOnly: store.setShowEditedOnly,
    setShowFavoritesOnly: store.setShowFavoritesOnly,
    toggleFavorite: store.toggleFavorite,
    updateMediaMetadata: store.updateMediaMetadata,
    setMediaEditedStatus: store.setMediaEditedStatus,
    onboardingCompleted: store.onboardingCompleted || false,
    setOnboardingCompleted: store.setOnboardingCompleted,
    setIsSearchFocused: store.setIsSearchFocused,

    markEpisodePlayed: store.markEpisodePlayed,
    unmarkEpisodePlayed: store.unmarkEpisodePlayed,

    watchlistIds,
    watchedIds,
    watchedMap,
  }), [
    store,
    watchlistIds,
    watchedIds,
    watchedMap,
  ]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
