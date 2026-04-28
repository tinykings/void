'use client';

import React, { createContext, useContext, useEffect, useRef, useMemo, useCallback } from 'react';
import { Media, UserState, SortOption, FilterType } from '@/lib/types';
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

  // O(1) lookup helpers
  watchlistIds: Set<string>;
  watchedIds: Set<string>;
  watchedMap: Map<string, Media>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const store = useStore();
  const { apiKey, isLoaded, tmdbSessionId, isSyncing, syncFromTMDB, setIsSyncing, setSession, processTVMigrations } = store;
  const initialSyncDone = useRef(false);
  const authCallbackHandled = useRef(false);

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

      if (authCallbackHandled.current) return;

      if (approved === 'true' && requestToken && requestToken === savedToken && apiKey) {
        authCallbackHandled.current = true;
        setIsSyncing(true);
        try {
          const sessionId = await createSession(apiKey, requestToken);
          if (!sessionId) {
            throw new Error('TMDB did not return a session id');
          }
          const account = await getAccountDetails(apiKey, sessionId);
          
          setSession(sessionId, account.id);
          
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
          localStorage.removeItem('tmdb_request_token');
          
          // Initial sync
          await syncFromTMDB(true);
        } catch (error) {
          console.error("TMDB Auth Error:", error);
        } finally {
          setIsSyncing(false);
        }
      }
    };

    if (typeof window !== 'undefined' && isLoaded && !initialSyncDone.current) {
      handleAuthCallback();
    }
  }, [apiKey, isLoaded, setIsSyncing, setSession, syncFromTMDB]);

  // Initial Sync and background loops
  useEffect(() => {
    if (isLoaded && tmdbSessionId && !initialSyncDone.current) {
      initialSyncDone.current = true;
      syncFromTMDB();
    }
  }, [isLoaded, tmdbSessionId, syncFromTMDB]);

  // Trigger sync on focus
  const handleFocus = useCallback(() => {
    if (isLoaded && !isSyncing) {
      syncFromTMDB();
    }
  }, [isLoaded, isSyncing, syncFromTMDB]);

  useEffect(() => {
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [handleFocus]);

  // TV migration loop
  useEffect(() => {
    if (!isLoaded) return;
    const interval = setInterval(() => {
      processTVMigrations();
    }, 60000); // Check every minute while app is open
    
    // Also run once after initial load
    const timeout = setTimeout(() => processTVMigrations(), 5000);
    
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isLoaded, processTVMigrations]);

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
    filter: store.filter,
    sort: store.sort,
    showWatched: store.showWatched || false,
    showEditedOnly: store.showEditedOnly || false,
    showFavoritesOnly: store.showFavoritesOnly || false,
    isSearchFocused: store.isSearchFocused || false,
    editedStatusMap: store.editedStatusMap,
    playedEpisodes: store.playedEpisodes,
    isLoaded: store.isLoaded,
    isSyncing: store.isSyncing,
    
    setApiKey: store.setApiKey,
    setVidAngelEnabled: store.setVidAngelEnabled,
    toggleWatchlist: store.toggleWatchlist,
    toggleWatched: store.toggleWatched,
    syncFromTMDB: store.syncFromTMDB,
    loginWithTMDB: store.loginWithTMDB,
    logoutTMDB: store.logoutTMDB,
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
