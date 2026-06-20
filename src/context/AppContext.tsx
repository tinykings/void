'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Media, UserState, SortOption, FilterType, CastMember } from '@/lib/types';
import { useStore } from '@/store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { getMediaDetails } from '@/lib/tmdb';
import { getRawgGameDetails } from '@/lib/rawg';
import { mapWithConcurrency } from '@/lib/concurrency';
import { getMediaKey, getMediaSource } from '@/lib/media';
import { toast } from 'sonner';

const METADATA_HYDRATION_CONCURRENCY = 1;

type PendingLibraryView = {
  mode: 'watchlist' | 'watched';
  filter: FilterType;
} | null;

type SheetSnapshot = {
  details: Media | null;
  actor: CastMember | null;
};

interface AppContextType extends UserState {
  setApiKey: (key: string) => void;
  setGistId: (id: string) => void;
  setGistToken: (token: string) => void;
  toggleWatchlist: (media: Media) => void;
  toggleWatched: (media: Media, rating?: number) => void;
  setLists: (watchlist: Media[], watched: Media[]) => void;
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
  watchedMap: Map<string, Media>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const store = useStore(useShallow((s) => ({
    apiKey: s.apiKey,
    gistId: s.gistId,
    gistToken: s.gistToken,
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
    setLists: s.setLists,
    syncFromGist: s.syncFromGist,
    setFilter: s.setFilter,
    setSort: s.setSort,
    setShowWatched: s.setShowWatched,
    setShowFavoritesOnly: s.setShowFavoritesOnly,
    toggleFavorite: s.toggleFavorite,
    updateMediaMetadata: s.updateMediaMetadata,
    setIsSearchFocused: s.setIsSearchFocused,
    processTVMigrations: s.processTVMigrations,
    markEpisodePlayed: s.markEpisodePlayed,
    unmarkEpisodePlayed: s.unmarkEpisodePlayed,
    toggleWatchlist: s.toggleWatchlist,
    toggleWatched: s.toggleWatched,
  })));
  const initialGistSyncDone = useRef('');
  const initialViewApplied = useRef(false);
  const hydratedMediaKeys = useRef<Set<string>>(new Set());
  const hydratingMediaKeys = useRef<Set<string>>(new Set());
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
  }, [store.watchlist, store.toggleWatchlist]);

  const toggleWatched = useCallback(async (media: Media, rating?: number) => {
    const mediaKey = getMediaKey(media);
    const inWatched = store.watched.some((item) => getMediaKey(item) === mediaKey);

    setPendingLibraryView(inWatched ? null : { mode: 'watched', filter: 'all' });
    await store.toggleWatched(media, rating);
  }, [store.watched, store.toggleWatched]);

  // Service worker registration
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      const registerServiceWorker = async () => {
        try {
          await navigator.serviceWorker.register('/sw.js', { scope: '/' });
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
      hydratingMediaKeys.current.clear();
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
    void store.syncFromGist(false).finally(() => {
      applyInitialView();
    });
  }, [
    store.isLoaded,
    store.sort,
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
      const key = getMediaKey(item);
      if (hydratedMediaKeys.current.has(key)) return false;
      if (hydratingMediaKeys.current.has(key)) return false;
      hydratingMediaKeys.current.add(key);
      return true;
    });

    if (itemsToHydrate.length === 0) return;

    void mapWithConcurrency(itemsToHydrate, METADATA_HYDRATION_CONCURRENCY, async (item) => {
      const key = getMediaKey(item);

      try {
        const source = getMediaSource(item);
        const details = item.media_type === 'game'
          ? source === 'steam'
            ? item
            : await getRawgGameDetails(item.id)
          : await getMediaDetails(item.id, item.media_type, store.apiKey);
        store.updateMediaMetadata(item.id, item.media_type, {
          ...details,
          date_added: item.date_added,
          isFavorite: item.isFavorite,
          lastChecked: Date.now(),
        }, source);
        hydratedMediaKeys.current.add(key);
      } catch (error) {
        console.error('Failed to hydrate library metadata:', error);
      } finally {
        hydratingMediaKeys.current.delete(key);
      }
    });
  }, [store.isLoaded, store.apiKey, store.watchlist, store.watched, store.updateMediaMetadata]);

  // TV auto-migration: move watched shows with upcoming episodes to watchlist
  useEffect(() => {
    if (!store.isLoaded || !store.apiKey) return;

    const timeout = setTimeout(async () => {
      try {
        const migrated = await store.processTVMigrations();
        if (migrated && migrated.length > 0) {
          migrated.forEach((item) => {
            toast(`${item.name || item.title}`, {
              description: "Moved to playlist, new episode airing soon",
            });
          });
        }
      } catch (err) {
        console.error('TV migration failed:', err);
      }
    }, 5000);

    return () => clearTimeout(timeout);
  }, [store.isLoaded, store.apiKey]);

  // O(1) lookup Maps for membership checks
  const watchlistIds = useMemo(() => new Set(store.watchlist.map(m => getMediaKey(m))), [store.watchlist]);
  const watchedIds = useMemo(() => new Set(store.watched.map(m => getMediaKey(m))), [store.watched]);
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
    toggleWatchlist,
    toggleWatched,
    setLists: store.setLists,
    syncFromGist: store.syncFromGist,
    setFilter: store.setFilter,
    setSort: store.setSort,
    setShowWatched: store.setShowWatched,
    setShowFavoritesOnly: store.setShowFavoritesOnly,
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
    watchedMap,
  }), [
    store,
    watchlistIds,
    watchedIds,
    watchedMap,
    activeDetailsMedia,
    activeActorMedia,
    openDetails,
    closeDetails,
    openActor,
    closeActor,
    closeAllSheets,
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
