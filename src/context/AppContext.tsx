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
  }, [state.apiKey]);

  // Load from local storage on mount
  useEffect(() => {
    const loaded = loadState();
    setState(loaded);
    setIsLoaded(true);

    if (loaded.tmdbSessionId && loaded.tmdbAccountId && loaded.apiKey && !initialLoadDone.current) {
      initialLoadDone.current = true;
      syncFromTMDBInternal(loaded.apiKey, loaded.tmdbSessionId, loaded.tmdbAccountId);
    }
  }, []);

  const syncFromTMDBInternal = async (apiKey: string, sessionId: string, accountId: number) => {
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
    } catch (error) {
      console.error("TMDB Sync Error:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const loginWithTMDB = async () => {
    if (!state.apiKey) return;
    try {
      const token = await createRequestToken(state.apiKey);
      localStorage.setItem('tmdb_request_token', token);
      const redirectUrl = `${window.location.origin}${window.location.pathname}`;
      window.location.href = `https://www.themoviedb.org/authenticate/${token}?redirect_to=${encodeURIComponent(redirectUrl)}`;
    } catch (error) {
      console.error("Failed to start TMDB login:", error);
    }
  };

  const logoutTMDB = () => {
    const newState = {
      ...state,
      tmdbSessionId: undefined,
      tmdbAccountId: undefined,
      watchlist: [],
      watched: []
    };
    setState(newState);
    saveState(newState);
  };

  const syncFromTMDB = async () => {
    if (state.apiKey && state.tmdbSessionId && state.tmdbAccountId) {
      await syncFromTMDBInternal(state.apiKey, state.tmdbSessionId, state.tmdbAccountId);
    }
  };

  // Trigger sync on focus
  useEffect(() => {
    const handleFocus = () => {
      if (isLoaded && !isSyncing) {
        syncFromTMDB();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isLoaded, isSyncing, state.apiKey, state.tmdbSessionId, state.tmdbAccountId]);

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

  // Effect to backfill missing next_episode_to_air and automatically migrate shows with new episodes
  useEffect(() => {
    const processTVInfo = async () => {
      if (!isLoaded || !state.apiKey || isSyncing || !state.tmdbSessionId || !state.tmdbAccountId) return;
      
      const showsToProcess = state.watched.filter(m => m.media_type === 'tv');
      if (showsToProcess.length === 0) return;

      let changedLocally = false;
      const updatedWatched = [...state.watched];

      for (let i = 0; i < updatedWatched.length; i++) {
        const m = updatedWatched[i];
        if (m.media_type === 'tv') {
          try {
            // Fetch fresh details to see if there's a next episode
            const details = await getMediaDetails(m.id, 'tv', state.apiKey);
            
            if (details.next_episode_to_air) {
              // --- MIGRATION LOGIC ---
              // 1. Add to watchlist on TMDB
              await toggleWatchlistStatus(state.apiKey, state.tmdbSessionId, state.tmdbAccountId, m.id, 'tv', true);
              // 2. Remove rating on TMDB
              await deleteRating(state.apiKey, state.tmdbSessionId, m.id, 'tv');
              
              // Remove from local watched list (it will be added to watchlist on next sync or we can do it now)
              updatedWatched.splice(i, 1);
              i--; 
              changedLocally = true;
            } else if (m.next_episode_to_air === undefined) {
              // Just backfill the null if no next episode exists
              updatedWatched[i] = { ...m, next_episode_to_air: null };
              changedLocally = true;
            }
          } catch (err) {
            console.error(`Failed to process TV info for ${m.id}:`, err);
          }
        }
      }

      if (changedLocally) {
        // Trigger a full sync to ensure local state perfectly matches TMDB after migrations
        syncFromTMDB();
      }
    };

    // We use a small timeout to avoid hammering the API immediately after a sync
    const timeout = setTimeout(processTVInfo, 2000);
    return () => clearTimeout(timeout);
  }, [isLoaded, state.apiKey, isSyncing, state.tmdbSessionId, state.tmdbAccountId]);

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