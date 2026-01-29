'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { Media, UserState, ExternalPlayerOption, externalPlayerOptions, SortOption, FilterType } from '@/lib/types';
import { loadState, saveState, toggleInList as toggleInStorage } from '@/lib/storage';
import { getMediaDetails, createRequestToken, createSession, getAccountDetails, getAccountLists, toggleWatchlistStatus, rateMedia, deleteRating } from '@/lib/tmdb';

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
  syncFromTMDB: () => Promise<void>;

  // New external player settings
  externalPlayerEnabled: boolean;
  selectedExternalPlayer: ExternalPlayerOption | null;
  toggleExternalPlayerEnabled: () => void;
  setSelectedExternalPlayerId: (id: string | null) => void;
  setFilter: (filter: FilterType) => void;
  setSort: (sort: SortOption) => void;
  setShowWatched: (show: boolean) => void;
  setShowEditedOnly: (show: boolean) => void;
  updateMediaMetadata: (id: number, type: 'movie' | 'tv', metadata: Partial<Media>) => void;
  setMediaEditedStatus: (id: number, type: 'movie' | 'tv', isEdited: boolean) => void;
  isSearchFocused: boolean;
  setIsSearchFocused: (focused: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<UserState>({
    apiKey: '',
    watchlist: [],
    watched: [],
    vidAngelEnabled: false,
    externalPlayerEnabled: false,
    selectedExternalPlayerId: null,
    filter: 'movie',
    sort: 'added',
    showWatched: false,
    showEditedOnly: false,
    isSearchFocused: false,
    editedStatusMap: {},
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const initialLoadDone = useRef(false);
  const lastSyncTime = useRef<number>(0);

  const syncFromTMDBInternal = useCallback(async (apiKey: string, sessionId: string, accountId: number) => {
    // Prevent syncing more than once every 30 seconds automatically
    const now = Date.now();
    if (now - lastSyncTime.current < 30000 && initialLoadDone.current) {
      return;
    }
    
    setIsSyncing(true);
    try {
      const fetchAll = async (type: 'movies' | 'tv', list: 'watchlist' | 'rated'): Promise<Media[]> => {
        let allItems: Media[] = [];
        let currentPage = 1;
        let totalPages = 1;

        do {
          const data = await getAccountLists(apiKey, sessionId, accountId, type, list, currentPage);
          allItems = [...allItems, ...data.results];
          totalPages = data.totalPages;
          currentPage++;
        } while (currentPage <= totalPages);

        return allItems;
      };

      const [wlMovies, wlTv, ratedMovies, ratedTv] = await Promise.all([
        fetchAll('movies', 'watchlist'),
        fetchAll('tv', 'watchlist'),
        fetchAll('movies', 'rated'),
        fetchAll('tv', 'rated'),
      ]);

      setState(prev => {
        const newState = {
          ...prev,
          watchlist: [...wlMovies, ...wlTv],
          watched: [...ratedMovies, ...ratedTv]
        };
        saveState(newState);
        return newState;
      });
      lastSyncTime.current = Date.now();
    } catch (error) {
      console.error("TMDB Sync Error:", error);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const syncFromTMDB = useCallback(async (force = false) => {
    if (state.apiKey && state.tmdbSessionId && state.tmdbAccountId) {
      if (force) lastSyncTime.current = 0; // Reset timer for manual sync
      await syncFromTMDBInternal(state.apiKey, state.tmdbSessionId, state.tmdbAccountId);
    }
  }, [state.apiKey, state.tmdbSessionId, state.tmdbAccountId, syncFromTMDBInternal]);

  // Handle TMDB Auth Callback
  useEffect(() => {
    const handleAuthCallback = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const approved = searchParams.get('approved');
      const requestToken = searchParams.get('request_token');
      const savedToken = localStorage.getItem('tmdb_request_token');

      if (approved === 'true' && requestToken && requestToken === savedToken && state.apiKey) {
        setIsSyncing(true);
        try {
          const sessionId = await createSession(state.apiKey, requestToken);
          const account = await getAccountDetails(state.apiKey, sessionId);
          
          const newState = {
            ...state,
            tmdbSessionId: sessionId,
            tmdbAccountId: account.id
          };
          
          setState(newState);
          saveState(newState);
          
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
          localStorage.removeItem('tmdb_request_token');
          
          // Initial sync
          lastSyncTime.current = 0;
          await syncFromTMDBInternal(state.apiKey, sessionId, account.id);
        } catch (error) {
          console.error("TMDB Auth Error:", error);
        } finally {
          setIsSyncing(false);
        }
      }
    };

    if (typeof window !== 'undefined' && !initialLoadDone.current) {
      handleAuthCallback();
    }
  }, [state.apiKey, state.tmdbSessionId, state.tmdbAccountId, syncFromTMDBInternal]);

  // Load from local storage on mount
  useEffect(() => {
    const loaded = loadState();
    setState(loaded);
    setIsLoaded(true);

    if (loaded.tmdbSessionId && loaded.tmdbAccountId && loaded.apiKey && !initialLoadDone.current) {
      initialLoadDone.current = true;
      syncFromTMDBInternal(loaded.apiKey, loaded.tmdbSessionId, loaded.tmdbAccountId);
    }
  }, [syncFromTMDBInternal]);

  // Trigger sync on focus
  useEffect(() => {
    const handleFocus = () => {
      if (isLoaded && !isSyncing) {
        syncFromTMDB();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isLoaded, isSyncing, syncFromTMDB]);

  const setApiKey = useCallback((apiKey: string) => {
    setState((prev) => ({ ...prev, apiKey }));
    saveState({ ...state, apiKey });
  }, [state]);

  const setVidAngelEnabled = useCallback((vidAngelEnabled: boolean) => {
    setState((prev) => ({ ...prev, vidAngelEnabled }));
    saveState({ ...state, vidAngelEnabled });
  }, [state]);

  // New external player functions
  const toggleExternalPlayerEnabled = useCallback(() => {
    setState((prev) => {
      const newEnabledState = !prev.externalPlayerEnabled;
      const newState = { ...prev, externalPlayerEnabled: newEnabledState };
      if (!newEnabledState) {
        newState.selectedExternalPlayerId = null; // Disable player selection if feature is off
      }
      saveState(newState);
      return newState;
    });
  }, []);

  const setSelectedExternalPlayerId = useCallback((id: string | null) => {
    setState((prev) => {
      const newState = { ...prev, selectedExternalPlayerId: id };
      saveState(newState);
      return newState;
    });
  }, []);

  const setFilter = useCallback((filter: FilterType) => {
    setState((prev) => {
      const newState = { ...prev, filter };
      saveState(newState);
      return newState;
    });
  }, []);

  const setSort = useCallback((sort: SortOption) => {
    setState((prev) => {
      const newState = { ...prev, sort };
      saveState(newState);
      return newState;
    });
  }, []);

  const setShowWatched = useCallback((showWatched: boolean) => {
    setState((prev) => {
      const newState = { ...prev, showWatched };
      saveState(newState);
      return newState;
    });
  }, []);

  const setShowEditedOnly = useCallback((showEditedOnly: boolean) => {
    setState((prev) => {
      const newState = { ...prev, showEditedOnly };
      saveState(newState);
      return newState;
    });
  }, []);

  const setIsSearchFocused = useCallback((isSearchFocused: boolean) => {
    setState((prev) => {
      const newState = { ...prev, isSearchFocused };
      saveState(newState);
      return newState;
    });
  }, []);

  const updateMediaMetadata = useCallback((id: number, type: 'movie' | 'tv', metadata: Partial<Media>) => {
    setState((prev) => {
      const updateList = (list: Media[]) => 
        list.map(m => m.id === id && m.media_type === type ? { ...m, ...metadata } : m);
      
      const newState = {
        ...prev,
        watchlist: updateList(prev.watchlist),
        watched: updateList(prev.watched)
      };
      
      saveState(newState);
      return newState;
    });
  }, []);

  const setMediaEditedStatus = useCallback((id: number, type: 'movie' | 'tv', isEdited: boolean) => {
    setState((prev) => {
      const key = `${type}-${id}`;
      const newMap = { ...prev.editedStatusMap, [key]: isEdited };
      const newState = { ...prev, editedStatusMap: newMap };
      saveState(newState);
      return newState;
    });
  }, []);

  const toggleWatchlist = useCallback(async (media: Media) => {
    const inWatchlist = state.watchlist.some((m) => m.id === media.id && m.media_type === media.media_type);
    
    if (inWatchlist) {
      if (!window.confirm(`Remove "${media.title || media.name}" from your watchlist?`)) {
        return;
      }
    }

    // Local update
    const newState = toggleInStorage(media, 'watchlist');
    setState(newState);

    // Sync with TMDB if logged in
    if (state.apiKey && state.tmdbSessionId && state.tmdbAccountId) {
      try {
        await toggleWatchlistStatus(
          state.apiKey, 
          state.tmdbSessionId, 
          state.tmdbAccountId, 
          media.id, 
          media.media_type, 
          !inWatchlist
        );
      } catch (error) {
        console.error("Failed to sync watchlist with TMDB:", error);
      }
    }
  }, [state]);

  const toggleWatched = useCallback(async (media: Media, rating?: number) => {
    const inWatched = state.watched.some((m) => m.id === media.id && m.media_type === media.media_type);
    
    if (inWatched && !rating) {
      if (!window.confirm(`Remove "${media.title || media.name}" from history?`)) {
        return;
      }
    }

    // Local update
    const newState = toggleInStorage(media, 'watched');
    setState(newState);

    // Sync with TMDB if logged in
    if (state.apiKey && state.tmdbSessionId && state.tmdbAccountId) {
      try {
        if (inWatched && !rating) {
          await deleteRating(state.apiKey, state.tmdbSessionId, media.id, media.media_type);
        } else {
          // Use provided rating or default to 1 star (2/10 on TMDB)
          await rateMedia(state.apiKey, state.tmdbSessionId, media.id, media.media_type, rating || 1);
        }
      } catch (error) {
        console.error("Failed to sync rating with TMDB:", error);
      }
    }
  }, [state]);

  const logoutTMDB = useCallback(() => {
    const newState = {
      ...state,
      tmdbSessionId: undefined,
      tmdbAccountId: undefined,
      watchlist: [],
      watched: []
    };
    setState(newState);
    saveState(newState);
  }, [state]);

  const loginWithTMDB = useCallback(async () => {
    if (!state.apiKey) return;
    try {
      const token = await createRequestToken(state.apiKey);
      localStorage.setItem('tmdb_request_token', token);
      const redirectUrl = `${window.location.origin}${window.location.pathname}`;
      window.location.href = `https://www.themoviedb.org/authenticate/${token}?redirect_to=${encodeURIComponent(redirectUrl)}`;
    } catch (error) {
      console.error("Failed to start TMDB login:", error);
    }
  }, [state.apiKey]);

  // Effect to backfill missing next_episode_to_air and automatically migrate shows with new episodes
  useEffect(() => {
    const processTVInfo = async () => {
      if (!isLoaded || !state.apiKey || isSyncing || !state.tmdbSessionId || !state.tmdbAccountId) return;
      
      const now = Date.now();
      const checkThreshold = 24 * 60 * 60 * 1000; // 24 hours

      // Filter for TV shows that:
      // 1. Are TV shows
      // 2. Are NOT ended or canceled
      // 3. Haven't been checked in the last 24 hours (or ever)
      const showsToProcess = state.watched.filter(m => 
        m.media_type === 'tv' && 
        m.status !== 'Ended' && 
        m.status !== 'Canceled' &&
        (now - (m.lastChecked || 0) > checkThreshold)
      );

      if (showsToProcess.length === 0) return;

      let changedLocally = false;
      const updatedWatched = [...state.watched];

      for (const show of showsToProcess) {
        try {
          // Fetch fresh details
          const details = await getMediaDetails(show.id, 'tv', state.apiKey);
          
          // Find index in the original list to update it
          const idx = updatedWatched.findIndex(m => m.id === show.id && m.media_type === 'tv');
          if (idx === -1) continue;

          if (details.next_episode_to_air) {
            // --- MIGRATION LOGIC ---
            await toggleWatchlistStatus(state.apiKey, state.tmdbSessionId, state.tmdbAccountId, show.id, 'tv', true);
            await deleteRating(state.apiKey, state.tmdbSessionId, show.id, 'tv');
            
            updatedWatched.splice(idx, 1);
            changedLocally = true;
          } else {
            // Just update metadata so we don't check again for 24h
            updatedWatched[idx] = { 
              ...updatedWatched[idx], 
              status: details.status,
              next_episode_to_air: null,
              lastChecked: now 
            };
            changedLocally = true;
          }
        } catch (err) {
          console.error(`Failed to process TV info for ${show.id}:`, err);
        }
      }

      if (changedLocally) {
        setState(prev => {
          const newState = { ...prev, watched: updatedWatched };
          saveState(newState);
          return newState;
        });
      }
    };

    const timeout = setTimeout(processTVInfo, 10000);
    return () => clearTimeout(timeout);
  }, [isLoaded, state.apiKey, isSyncing, state.tmdbSessionId, state.tmdbAccountId, state.watched.length]);

  // Derive selectedExternalPlayer from selectedExternalPlayerId
  const selectedExternalPlayer = state.selectedExternalPlayerId
    ? externalPlayerOptions.find(opt => opt.id === state.selectedExternalPlayerId) || null
    : null;

  return (
    <AppContext.Provider
      value={{
        ...state,
        setApiKey,
        setVidAngelEnabled,
        toggleWatchlist,
        toggleWatched,
        syncFromTMDB,
        loginWithTMDB,
        logoutTMDB,
        isLoaded,
        isSyncing,
        // New values
        externalPlayerEnabled: state.externalPlayerEnabled || false,
        selectedExternalPlayer,
        toggleExternalPlayerEnabled,
        setSelectedExternalPlayerId,
        setFilter,
        setSort,
        setShowWatched,
        showEditedOnly: state.showEditedOnly || false,
        setShowEditedOnly,
        updateMediaMetadata,
        editedStatusMap: state.editedStatusMap || {},
        setMediaEditedStatus,
        isSearchFocused: state.isSearchFocused || false,
        setIsSearchFocused,
      }}
    >
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