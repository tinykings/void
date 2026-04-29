'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Media, UserState, SortOption, FilterType, CastMember } from '@/lib/types';
import { useStore } from '@/store/useStore';
import { getMediaDetails } from '@/lib/tmdb';

type PendingLibraryView = {
  mode: 'watchlist' | 'watched';
  filter: FilterType;
} | null;

type SheetSnapshot = {
  details: Media | null;
  poster: Media | null;
  actor: CastMember | null;
};

interface AppContextType extends UserState {
  setApiKey: (key: string) => void;
  setGistId: (id: string) => void;
  setGistToken: (token: string) => void;
  setVidAngelEnabled: (enabled: boolean) => void;
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
  updateMediaMetadata: (id: number, type: 'movie' | 'tv', metadata: Partial<Media>) => void;
  setMediaEditedStatus: (id: number, type: 'movie' | 'tv', isEdited: boolean) => void;
  isSearchFocused: boolean;
  setIsSearchFocused: (focused: boolean) => void;
  syncFromGist: () => Promise<void>;
  activeDetailsMedia: Media | null;
  activePosterMedia: Media | null;
  activeActorMedia: CastMember | null;
  openDetails: (media: Media) => void;
  closeDetails: () => void;
  openPoster: (media: Media) => void;
  closePoster: () => void;
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
  const store = useStore();
  const initialGistSyncDone = useRef('');
  const initialViewApplied = useRef(false);
  const hydratedMediaKeys = useRef<Set<string>>(new Set());
  const sheetReturnRef = useRef<SheetSnapshot | null>(null);
  const [pendingLibraryView, setPendingLibraryView] = useState<PendingLibraryView>(null);
  const [activeDetailsMedia, setActiveDetailsMedia] = useState<Media | null>(null);
  const [activePosterMedia, setActivePosterMedia] = useState<Media | null>(null);
  const [activeActorMedia, setActiveActorMedia] = useState<CastMember | null>(null);
  const rememberCurrentSheet = useCallback(() => {
    if (!activeDetailsMedia && !activePosterMedia && !activeActorMedia) {
      sheetReturnRef.current = null;
      return;
    }

    sheetReturnRef.current = {
      details: activeDetailsMedia,
      poster: activePosterMedia,
      actor: activeActorMedia,
    };
  }, [activeActorMedia, activeDetailsMedia, activePosterMedia]);
  const restoreSheetSnapshot = useCallback((snapshot?: SheetSnapshot | null) => {
    if (!snapshot) return false;

    setActiveDetailsMedia(snapshot.details);
    setActivePosterMedia(snapshot.poster);
    setActiveActorMedia(snapshot.actor);
    return true;
  }, []);
  const applyPendingLibraryView = useCallback(() => {
    if (!pendingLibraryView) return false;

    const nextView = pendingLibraryView;
    setPendingLibraryView(null);
    sheetReturnRef.current = null;
    setActiveActorMedia(null);
    setActivePosterMedia(null);
    setActiveDetailsMedia(null);
    store.setFilter(nextView.filter);
    store.setShowWatched(nextView.mode === 'watched');
    store.setShowFavoritesOnly(false);
    return true;
  }, [pendingLibraryView, store]);
  const openDetails = useCallback((media: Media) => {
    rememberCurrentSheet();
    setActiveActorMedia(null);
    setActivePosterMedia(null);
    setActiveDetailsMedia(media);
  }, [rememberCurrentSheet]);
  const openPoster = useCallback((media: Media) => {
    rememberCurrentSheet();
    setActiveDetailsMedia(null);
    setActiveActorMedia(null);
    setActivePosterMedia(media);
  }, [rememberCurrentSheet]);
  const openActor = useCallback((actor: CastMember) => {
    rememberCurrentSheet();
    setActivePosterMedia(null);
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
    setActivePosterMedia(null);
    setActiveDetailsMedia(null);
  }, [applyPendingLibraryView, restoreSheetSnapshot]);
  const closeDetails = useCallback(() => {
    closeCurrentSheet();
  }, [closeCurrentSheet]);
  const closePoster = useCallback(() => {
    closeCurrentSheet();
  }, [closeCurrentSheet]);
  const closeActor = useCallback(() => {
    closeCurrentSheet();
  }, [closeCurrentSheet]);
  const closeAllSheets = useCallback(() => {
    sheetReturnRef.current = null;
    applyPendingLibraryView();

    setActiveActorMedia(null);
    setActivePosterMedia(null);
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
    const mediaKey = `${media.media_type}-${media.id}`;
    const inWatchlist = store.watchlist.some((item) => `${item.media_type}-${item.id}` === mediaKey);

    setPendingLibraryView(inWatchlist ? null : { mode: 'watchlist', filter: media.media_type });
    await store.toggleWatchlist(media);
  }, [store]);

  const toggleWatched = useCallback(async (media: Media, rating?: number) => {
    const mediaKey = `${media.media_type}-${media.id}`;
    const inWatched = store.watched.some((item) => `${item.media_type}-${item.id}` === mediaKey);

    setPendingLibraryView(inWatched ? null : { mode: 'watched', filter: media.media_type });
    await store.toggleWatched(media, rating);
  }, [store]);

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
    void store.syncFromGist().finally(() => {
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
    setMediaEditedStatus: store.setMediaEditedStatus,
    setIsSearchFocused: store.setIsSearchFocused,
    activeDetailsMedia,
    activePosterMedia,
    activeActorMedia,
    openDetails,
    closeDetails,
    openPoster,
    closePoster,
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
    activePosterMedia,
    activeActorMedia,
    openDetails,
    closeDetails,
    openPoster,
    closePoster,
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
