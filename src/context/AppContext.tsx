'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Media, UserState, SortOption, FilterType } from '@/lib/types';
import { useStore } from '@/store/useStore';
import { getMediaDetails } from '@/lib/tmdb';

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
  showFavoritesOnly: boolean;
  setShowFavoritesOnly: (show: boolean) => void;
  toggleFavorite: (media: Media) => void;
  updateMediaMetadata: (id: number, type: 'movie' | 'tv', metadata: Partial<Media>) => void;
  setMediaEditedStatus: (id: number, type: 'movie' | 'tv', isEdited: boolean) => void;
  isSearchFocused: boolean;
  setIsSearchFocused: (focused: boolean) => void;
  syncFromGist: () => Promise<void>;
  activeDetailsMedia: Media | null;
  activePosterMedia: Media | null;
  openDetails: (media: Media) => void;
  closeDetails: () => void;
  openPoster: (media: Media) => void;
  closePoster: () => void;

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
  const initialViewApplied = useRef(false);
  const hydratedMediaKeys = useRef<Set<string>>(new Set());
  const [activeDetailsMedia, setActiveDetailsMedia] = useState<Media | null>(null);
  const [activePosterMedia, setActivePosterMedia] = useState<Media | null>(null);
  const openDetails = useCallback((media: Media) => {
    setActivePosterMedia(null);
    setActiveDetailsMedia(media);
  }, []);
  const closeDetails = useCallback(() => {
    setActivePosterMedia(null);
    setActiveDetailsMedia(null);
  }, []);
  const openPoster = useCallback((media: Media) => setActivePosterMedia(media), []);
  const closePoster = useCallback(() => setActivePosterMedia(null), []);

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
    if (!store.isLoaded) {
      initialGistSyncDone.current = '';
      initialViewApplied.current = false;
      hydratedMediaKeys.current.clear();
      return;
    }

    const applyInitialView = () => {
      if (initialViewApplied.current) return;

      if (store.isSearchFocused || store.showWatched) {
        initialViewApplied.current = true;
        return;
      }

      if (store.watchlist.length === 0 && store.watched.length === 0) {
        store.setIsSearchFocused(true);
      } else if (store.watchlist.length === 0 && store.watched.length > 0) {
        store.setShowWatched(true);
      }

      initialViewApplied.current = true;
    };

    if (!store.gistId || !store.gistToken) {
      applyInitialView();
      return;
    }

    const signature = `${store.gistId}:${store.gistToken}`;
    if (initialGistSyncDone.current === signature) {
      applyInitialView();
      return;
    }

    initialGistSyncDone.current = signature;
    void store.syncFromGist().finally(() => {
      applyInitialView();
    });
  }, [
    store.isLoaded,
    store.gistId,
    store.gistToken,
    store.watchlist.length,
    store.watched.length,
    store.showWatched,
    store.isSearchFocused,
    store.syncFromGist,
  ]);

  useEffect(() => {
    if (!store.isLoaded || !store.apiKey) return;

    const incompleteItems = [...store.watchlist, ...store.watched].filter((item) => !item.poster_path);
    const itemsToHydrate = incompleteItems.filter((item) => {
      const key = `${item.media_type}-${item.id}`;
      if (hydratedMediaKeys.current.has(key)) return false;
      hydratedMediaKeys.current.add(key);
      return true;
    });

    if (itemsToHydrate.length === 0) return;

    void Promise.all(itemsToHydrate.map(async (item) => {
      try {
        const details = await getMediaDetails(item.id, item.media_type, store.apiKey);
        store.updateMediaMetadata(item.id, item.media_type, {
          ...details,
          date_added: item.date_added,
          isFavorite: item.isFavorite,
          lastChecked: Date.now(),
        });
      } catch (error) {
        console.error('Failed to hydrate library metadata:', error);
      }
    }));
  }, [store.isLoaded, store.apiKey, store.watchlist, store.watched, store.updateMediaMetadata]);

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
    setShowFavoritesOnly: store.setShowFavoritesOnly,
    toggleFavorite: store.toggleFavorite,
    updateMediaMetadata: store.updateMediaMetadata,
    setMediaEditedStatus: store.setMediaEditedStatus,
    setIsSearchFocused: store.setIsSearchFocused,
    activeDetailsMedia,
    activePosterMedia,
    openDetails,
    closeDetails,
    openPoster,
    closePoster,

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
    activeDetailsMedia,
    activePosterMedia,
    openDetails,
    closeDetails,
    openPoster,
    closePoster,
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
