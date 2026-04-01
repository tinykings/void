'use client';

import React, { createContext, useContext, useEffect, useRef, useMemo, useCallback } from 'react';
import { Media, UserState, ExternalPlayerOption, externalPlayerOptions, SortOption, FilterType } from '@/lib/types';
import { useStore } from '@/store/useStore';
import { createSession, getAccountDetails } from '@/lib/tmdb';

interface AppContextType extends UserState {
  setApiKey: (key: string) => void;
  setVidAngelEnabled: (enabled: boolean) => void;
  toggleWatchlist: (media: Media) => void;
  toggleWatched: (media: Media, rating?: number) => void;
  isLoaded: boolean;
  isSyncing: boolean;

  // TMDB Auth
  loginWithTMDB: () => Promise<void>;
  logoutTMDB: () => void;
  syncFromTMDB: (force?: boolean) => Promise<void>;

  // New external player settings
  externalPlayerEnabled: boolean;
  selectedExternalPlayer: ExternalPlayerOption | null;
  toggleExternalPlayerEnabled: () => void;
  setSelectedExternalPlayerId: (id: string | null) => void;
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

  // Episode tracking
  markEpisodePlayed: (tmdbId: number, seasonNum: number, episodeNum: number) => void;
  unmarkEpisodePlayed: (tmdbId: number, seasonNum: number, episodeNum: number) => void;

  // Send to TV
  sendToTvEnabled: boolean;
  gistId: string;
  gistToken: string;
  setSendToTvEnabled: (enabled: boolean) => void;
  setGistId: (id: string) => void;
  setGistToken: (token: string) => void;
  sendToGist: (url: string, title: string) => Promise<void>;

  // O(1) lookup helpers
  watchlistIds: Set<string>;
  watchedIds: Set<string>;
  watchedMap: Map<string, Media>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const store = useStore();
  const initialSyncDone = useRef(false);

  // Handle TMDB Auth Callback and Service Worker Registration
  useEffect(() => {
    // Service Worker Registration
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

    const handleAuthCallback = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const approved = searchParams.get('approved');
      const requestToken = searchParams.get('request_token');
      const savedToken = localStorage.getItem('tmdb_request_token');

      if (approved === 'true' && requestToken && requestToken === savedToken && store.apiKey) {
        store.setIsSyncing(true);
        try {
          const sessionId = await createSession(store.apiKey, requestToken);
          const account = await getAccountDetails(store.apiKey, sessionId);
          
          store.setSession(sessionId, account.id);
          
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
          localStorage.removeItem('tmdb_request_token');
          
          // Initial sync
          await store.syncFromTMDB(true);
        } catch (error) {
          console.error("TMDB Auth Error:", error);
        } finally {
          store.setIsSyncing(false);
        }
      }
    };

    if (typeof window !== 'undefined' && store.isLoaded && !initialSyncDone.current) {
      handleAuthCallback();
    }
  }, [store]);

  // Initial Sync and background loops
  useEffect(() => {
    if (store.isLoaded && store.tmdbSessionId && !initialSyncDone.current) {
      initialSyncDone.current = true;
      store.syncFromTMDB();
    }
  }, [store]);

  // Trigger sync on focus
  const handleFocus = useCallback(() => {
    if (store.isLoaded && !store.isSyncing) {
      store.syncFromTMDB();
    }
  }, [store]);

  useEffect(() => {
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [handleFocus]);

  // TV migration loop
  useEffect(() => {
    if (!store.isLoaded) return;
    const interval = setInterval(() => {
      store.processTVMigrations();
    }, 60000); // Check every minute while app is open
    
    // Also run once after initial load
    const timeout = setTimeout(() => store.processTVMigrations(), 5000);
    
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [store]);

  // Derive selectedExternalPlayer
  const selectedExternalPlayer = useMemo(() => {
    if (!store.selectedExternalPlayerId) return null;
    return externalPlayerOptions.find(opt => opt.id === store.selectedExternalPlayerId) || null;
  }, [store.selectedExternalPlayerId]);

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
    watchlist: store.watchlist,
    watched: store.watched,
    tmdbSessionId: store.tmdbSessionId,
    tmdbAccountId: store.tmdbAccountId,
    vidAngelEnabled: store.vidAngelEnabled || false,
    externalPlayerEnabled: store.externalPlayerEnabled || false,
    selectedExternalPlayerId: store.selectedExternalPlayerId,
    selectedExternalPlayer,
    filter: store.filter,
    sort: store.sort,
    showWatched: store.showWatched || false,
    showEditedOnly: store.showEditedOnly || false,
    showFavoritesOnly: store.showFavoritesOnly || false,
    isSearchFocused: store.isSearchFocused || false,
    editedStatusMap: store.editedStatusMap,
    playedEpisodes: store.playedEpisodes,
    sendToTvEnabled: store.sendToTvEnabled || false,
    gistId: store.gistId || '',
    gistToken: store.gistToken || '',
    isLoaded: store.isLoaded,
    isSyncing: store.isSyncing,
    
    setApiKey: store.setApiKey,
    setVidAngelEnabled: store.setVidAngelEnabled,
    toggleWatchlist: store.toggleWatchlist,
    toggleWatched: store.toggleWatched,
    syncFromTMDB: store.syncFromTMDB,
    loginWithTMDB: store.loginWithTMDB,
    logoutTMDB: store.logoutTMDB,
    toggleExternalPlayerEnabled: store.toggleExternalPlayerEnabled,
    setSelectedExternalPlayerId: store.setSelectedExternalPlayerId,
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

    setSendToTvEnabled: store.setSendToTvEnabled,
    setGistId: store.setGistId,
    setGistToken: store.setGistToken,
    sendToGist: store.sendToGist,

    watchlistIds,
    watchedIds,
    watchedMap,
  }), [
    store,
    selectedExternalPlayer,
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
