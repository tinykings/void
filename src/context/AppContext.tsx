'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Media, UserState, SortOption, FilterType, CastMember } from '@/lib/types';
import { useStore } from '@/store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { useLibraryMetadataRefresh } from '@/hooks/useLibraryMetadataRefresh';
import { getMediaKey } from '@/lib/media';
import { toast } from 'sonner';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

const normalizeBasePath = (path?: string) => {
  const trimmedPath = (path || '').trim().replace(/^\/+|\/+$/g, '');
  return trimmedPath ? `/${trimmedPath}` : '';
};
const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
const serviceWorkerUrl = `${basePath}/sw.js`;
const serviceWorkerScope = `${basePath || ''}/`;
type PendingLibraryView = {
  mode: 'watchlist' | 'watched';
  filter: FilterType;
} | null;

type SheetSnapshot = {
  details: Media | null;
  actor: CastMember | null;
};

interface AppContextType extends UserState {
  togglePin: (media: Media) => void;
  setApiKey: (key: string) => void;
  setGistId: (id: string) => void;
  setGistToken: (token: string) => void;
  setGithubConnection: (gistId: string, token: string, login: string) => void;
  disconnectGithub: () => void;
  isGithubConnected: boolean;
  toggleWatchlist: (media: Media) => void;
  toggleWatched: (media: Media, rating?: number) => void;
  setLists: (watchlist: Media[], watched: Media[], playedEpisodes?: Record<string, boolean>) => void;
  isLoaded: boolean;

  setFilter: (filter: FilterType) => void;
  setSort: (sort: SortOption) => void;
  setShowWatched: (show: boolean) => void;
  showFavoritesOnly: boolean;
  setShowFavoritesOnly: (show: boolean) => void;
  toggleFavorite: (media: Media) => void;
  updateMediaMetadata: (id: number, type: 'movie' | 'tv' | 'game', metadata: Partial<Media>, source?: Media['source']) => void;
  isSearchFocused: boolean;
  setIsSearchFocused: (focused: boolean) => void;
  syncFromGist: (showIndicator?: boolean) => Promise<void>;
  isSyncingLibrary: boolean;
  activeDetailsMedia: Media | null;
  activeActorMedia: CastMember | null;
  openDetails: (media: Media) => void;
  closeDetails: () => void;
  openActor: (actor: CastMember) => void;
  closeActor: () => void;
  closeAllSheets: () => void;

  // Episode tracking
  markEpisodePlayed: (tmdbId: number, seasonNum: number, episodeNum: number) => void;
  unmarkEpisodePlayed: (tmdbId: number, seasonNum: number, episodeNum: number) => void;

  // O(1) lookup helpers
  watchlistIds: Set<string>;
  watchedIds: Set<string>;
  watchlistMap: Map<string, Media>;
  watchedMap: Map<string, Media>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isOnline = useOnlineStatus();
  const store = useStore(useShallow((s) => ({
    togglePin: s.togglePin,
    apiKey: s.apiKey,
    gistId: s.gistId,
    gistToken: s.gistToken,
    githubLogin: s.githubLogin,
    watchlist: s.watchlist,
    watched: s.watched,
    filter: s.filter,
    sort: s.sort,
    showWatched: s.showWatched,
    showFavoritesOnly: s.showFavoritesOnly,
    isSearchFocused: s.isSearchFocused,
    isSyncingLibrary: s.isSyncingLibrary,
    playedEpisodes: s.playedEpisodes,
    isLoaded: s.isLoaded,
    setApiKey: s.setApiKey,
    setGistId: s.setGistId,
    setGistToken: s.setGistToken,
    setGithubConnection: s.setGithubConnection,
    disconnectGithub: s.disconnectGithub,
    setLists: s.setLists,
    syncFromGist: s.syncFromGist,
    setFilter: s.setFilter,
    setSort: s.setSort,
    setShowWatched: s.setShowWatched,
    setShowFavoritesOnly: s.setShowFavoritesOnly,
    toggleFavorite: s.toggleFavorite,
    updateMediaMetadata: s.updateMediaMetadata,
    setIsSearchFocused: s.setIsSearchFocused,
    refreshLibraryMetadata: s.refreshLibraryMetadata,
    markEpisodePlayed: s.markEpisodePlayed,
    unmarkEpisodePlayed: s.unmarkEpisodePlayed,
    toggleWatchlist: s.toggleWatchlist,
    toggleWatched: s.toggleWatched,
  })));
  const initialGistSyncDone = useRef('');
  const initialViewApplied = useRef(false);
  useLibraryMetadataRefresh({
    enabled: store.isLoaded && isOnline && !!store.apiKey,
    watchlist: store.watchlist,
    watched: store.watched,
    refreshLibraryMetadata: store.refreshLibraryMetadata,
  });
  const sheetReturnRef = useRef<SheetSnapshot | null>(null);
  const [pendingLibraryView, setPendingLibraryView] = useState<PendingLibraryView>(null);
  const [activeDetailsMedia, setActiveDetailsMedia] = useState<Media | null>(null);
  const [activeActorMedia, setActiveActorMedia] = useState<CastMember | null>(null);

  const rememberCurrentSheet = useCallback(() => {
    if (!activeDetailsMedia && !activeActorMedia) {
      sheetReturnRef.current = null;
      return;
    }

    sheetReturnRef.current = {
      details: activeDetailsMedia,
      actor: activeActorMedia,
    };
  }, [activeActorMedia, activeDetailsMedia]);
  const restoreSheetSnapshot = useCallback((snapshot?: SheetSnapshot | null) => {
    if (!snapshot) return false;

    setActiveDetailsMedia(snapshot.details);
    setActiveActorMedia(snapshot.actor);
    return true;
  }, []);
  const applyPendingLibraryView = useCallback(() => {
    if (!pendingLibraryView) return false;

    const nextView = pendingLibraryView;
    setPendingLibraryView(null);
    sheetReturnRef.current = null;
    setActiveActorMedia(null);
    setActiveDetailsMedia(null);
    store.setFilter(nextView.filter);
    store.setShowWatched(nextView.mode === 'watched');
    store.setShowFavoritesOnly(false);
    return true;
  }, [pendingLibraryView, store]);
  const openDetails = useCallback((media: Media) => {
    rememberCurrentSheet();
    setActiveActorMedia(null);
    setActiveDetailsMedia(media);
  }, [rememberCurrentSheet]);
  const openActor = useCallback((actor: CastMember) => {
    rememberCurrentSheet();
    setActiveDetailsMedia(null);
    setActiveActorMedia(actor);
  }, [rememberCurrentSheet]);
  const closeCurrentSheet = useCallback(() => {
    const previous = sheetReturnRef.current;
    sheetReturnRef.current = null;

    if (previous) {
      restoreSheetSnapshot(previous);
      return;
    }

    if (applyPendingLibraryView()) return;

    setActiveActorMedia(null);
    setActiveDetailsMedia(null);
  }, [applyPendingLibraryView, restoreSheetSnapshot]);
  const closeDetails = useCallback(() => {
    closeCurrentSheet();
  }, [closeCurrentSheet]);
  const closeActor = useCallback(() => {
    closeCurrentSheet();
  }, [closeCurrentSheet]);
  const closeAllSheets = useCallback(() => {
    sheetReturnRef.current = null;
    applyPendingLibraryView();

    setActiveActorMedia(null);
    setActiveDetailsMedia(null);
    store.setIsSearchFocused(false);
  }, [applyPendingLibraryView, store]);

  useEffect(() => {
    if (!store.isLoaded) return;

    if (store.watchlist.length === 0 && store.watched.length === 0) {
      store.setShowWatched(false);
      store.setShowFavoritesOnly(false);
      store.setIsSearchFocused(true);
    }
  }, [store.isLoaded, store.watchlist.length, store.watched.length]);

  const toggleWatchlist = useCallback(async (media: Media) => {
    const mediaKey = getMediaKey(media);
    const inWatchlist = store.watchlist.some((item) => getMediaKey(item) === mediaKey);

    setPendingLibraryView(inWatchlist ? null : { mode: 'watchlist', filter: 'all' });
    await store.toggleWatchlist(media);
  }, [store]);

  const toggleWatched = useCallback(async (media: Media, rating?: number) => {
    const mediaKey = getMediaKey(media);
    const inWatched = store.watched.some((item) => getMediaKey(item) === mediaKey);

    setPendingLibraryView(inWatched ? null : { mode: 'watched', filter: 'all' });
    await store.toggleWatched(media, rating);
  }, [store]);

  const syncFromGist = useCallback(async (showIndicator = false) => {
    if (!isOnline) {
      toast('Sync unavailable offline', {
        description: 'Your local collection is still available.',
      });
      return;
    }

    try {
      await store.syncFromGist(showIndicator);
    } catch (error) {
      toast.error('Could not sync collection', {
        description: error instanceof Error ? error.message : 'GitHub sync failed. Your local collection is unchanged.',
      });
    }
  }, [isOnline, store]);

  // Service worker registration
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      const registerServiceWorker = async () => {
        try {
          await navigator.serviceWorker.register(serviceWorkerUrl, { scope: serviceWorkerScope, updateViaCache: 'none' });
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
      return;
    }

    if (store.sort !== 'added') {
      store.setSort('added');
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

    if (!isOnline || !store.gistId || !store.gistToken || !store.githubLogin) {
      applyInitialView();
      return;
    }

    const signature = `${store.gistId}:${store.gistToken}`;
    if (initialGistSyncDone.current === signature) {
      applyInitialView();
      return;
    }

    initialGistSyncDone.current = signature;
    void store.syncFromGist(false)
      .catch((error) => {
        toast.error('Could not sync collection', {
          description: error instanceof Error ? error.message : 'GitHub sync failed. Your local collection is unchanged.',
        });
      })
      .finally(() => {
        applyInitialView();
      });
  }, [
    store.isLoaded,
    isOnline,
    store.sort,
    store.gistId,
    store.gistToken,
    store.githubLogin,
    store.watchlist.length,
    store.watched.length,
    store.showWatched,
    store.isSearchFocused,
    store.syncFromGist,
  ]);

  // O(1) lookup Maps for membership checks
  const watchlistIds = useMemo(() => new Set(store.watchlist.map(m => getMediaKey(m))), [store.watchlist]);
  const watchedIds = useMemo(() => new Set(store.watched.map(m => getMediaKey(m))), [store.watched]);
  const watchlistMap = useMemo(() => {
    const map = new Map<string, Media>();
    store.watchlist.forEach(m => map.set(getMediaKey(m), m));
    return map;
  }, [store.watchlist]);
  const watchedMap = useMemo(() => {
    const map = new Map<string, Media>();
    store.watched.forEach(m => map.set(getMediaKey(m), m));
    return map;
  }, [store.watched]);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo<AppContextType>(() => ({
    apiKey: store.apiKey,
    gistId: store.gistId,
    gistToken: store.gistToken,
    githubLogin: store.githubLogin,
    watchlist: store.watchlist,
    watched: store.watched,
    filter: store.filter,
    sort: store.sort,
    showWatched: store.showWatched || false,
    showFavoritesOnly: store.showFavoritesOnly || false,
    isSearchFocused: store.isSearchFocused || false,
    isSyncingLibrary: store.isSyncingLibrary || false,
    playedEpisodes: store.playedEpisodes,
    isLoaded: store.isLoaded,
    
    setApiKey: store.setApiKey,
    setGistId: store.setGistId,
    setGistToken: store.setGistToken,
    setGithubConnection: store.setGithubConnection,
    disconnectGithub: store.disconnectGithub,
    isGithubConnected: Boolean(store.gistId && store.gistToken && store.githubLogin),
    toggleWatchlist,
    toggleWatched,
    setLists: store.setLists,
    syncFromGist,
    setFilter: store.setFilter,
    setSort: store.setSort,
    setShowWatched: store.setShowWatched,
    setShowFavoritesOnly: store.setShowFavoritesOnly,
    togglePin: store.togglePin,
    toggleFavorite: store.toggleFavorite,
    updateMediaMetadata: store.updateMediaMetadata,
    setIsSearchFocused: store.setIsSearchFocused,
    activeDetailsMedia,
    activeActorMedia,
    openDetails,
    closeDetails,
    openActor,
    closeActor,
    closeAllSheets,

    markEpisodePlayed: store.markEpisodePlayed,
    unmarkEpisodePlayed: store.unmarkEpisodePlayed,

    watchlistIds,
    watchedIds,
    watchlistMap,
    watchedMap,
  }), [
    store,
    toggleWatchlist,
    toggleWatched,
    watchlistIds,
    watchedIds,
    watchlistMap,
    watchedMap,
    activeDetailsMedia,
    activeActorMedia,
    openDetails,
    closeDetails,
    openActor,
    closeActor,
    closeAllSheets,
    syncFromGist,
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
