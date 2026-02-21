'use client';

import React, { createContext, useContext, useEffect, useRef } from 'react';
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

  // Gist Backup
  gistBackupEnabled: boolean;
  setGistBackupEnabled: (enabled: boolean) => void;
  backupToGist: () => Promise<void>;
  lastBackupTime?: number;

  // TV Support
  tvSupportEnabled: boolean;
  tvGistId?: string;
  tvGistToken?: string;
  setTvSupportEnabled: (enabled: boolean) => void;
  setTvGistConfig: (id: string, token: string) => void;
  sendToTv: (url: string, title: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const store = useStore();
  const initialSyncDone = useRef(false);

  // Handle TMDB Auth Callback
  useEffect(() => {
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
  }, [store.apiKey, store.isLoaded]);

  // Initial Sync and background loops
  useEffect(() => {
    if (store.isLoaded && store.tmdbSessionId && !initialSyncDone.current) {
      initialSyncDone.current = true;
      store.syncFromTMDB();
    }
  }, [store.isLoaded, store.tmdbSessionId]);

  // Trigger sync on focus
  useEffect(() => {
    const handleFocus = () => {
      if (store.isLoaded && !store.isSyncing) {
        store.syncFromTMDB();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [store.isLoaded, store.isSyncing]);

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
  }, [store.isLoaded]);

  // Gist backup loop
  useEffect(() => {
    if (!store.isLoaded) return;

    const tryBackup = () => {
      if (!store.gistBackupEnabled || !store.tvGistId || !store.tvGistToken) return;
      const elapsed = Date.now() - (store.lastBackupTime || 0);
      if (elapsed >= 24 * 60 * 60 * 1000) {
        store.backupToGist();
      }
    };

    const timeout = setTimeout(tryBackup, 10000); // check shortly after load
    const interval = setInterval(tryBackup, 60 * 60 * 1000); // then every 60 min

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [store.isLoaded, store.gistBackupEnabled, store.tvGistId, store.tvGistToken, store.lastBackupTime]);

  // Derive selectedExternalPlayer
  const selectedExternalPlayer = store.selectedExternalPlayerId
    ? externalPlayerOptions.find(opt => opt.id === store.selectedExternalPlayerId) || null
    : null;

  const value: AppContextType = {
    apiKey: store.apiKey,
    watchlist: store.watchlist,
    watched: store.watched,
    tmdbSessionId: store.tmdbSessionId,
    tmdbAccountId: store.tmdbAccountId,
    vidAngelEnabled: store.vidAngelEnabled,
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
    gistBackupEnabled: store.gistBackupEnabled || false,
    setGistBackupEnabled: store.setGistBackupEnabled,
    backupToGist: store.backupToGist,
    lastBackupTime: store.lastBackupTime,
    tvSupportEnabled: store.tvSupportEnabled || false,
    tvGistId: store.tvGistId,
    tvGistToken: store.tvGistToken,
    setTvSupportEnabled: store.setTvSupportEnabled,
    setTvGistConfig: store.setTvGistConfig,
    sendToTv: store.sendToTv,
  };

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
