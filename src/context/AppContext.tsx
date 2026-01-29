'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
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
  updateMediaMetadata: (id: number, type: 'movie' | 'tv', metadata: Partial<Media>) => void;
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
    isSearchFocused: false,
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
      const [wlMovies, wlTv, ratedMovies, ratedTv] = await Promise.all([
        getAccountLists(apiKey, sessionId, accountId, 'movies', 'watchlist'),
        getAccountLists(apiKey, sessionId, accountId, 'tv', 'watchlist'),
        getAccountLists(apiKey, sessionId, accountId, 'movies', 'rated'),
        getAccountLists(apiKey, sessionId, accountId, 'tv', 'rated'),
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

  const setApiKey = (apiKey: string) => {
    setState((prev) => ({ ...prev, apiKey }));
    saveState({ ...state, apiKey });
  };

  const setVidAngelEnabled = (vidAngelEnabled: boolean) => {
    setState((prev) => ({ ...prev, vidAngelEnabled }));
    saveState({ ...state, vidAngelEnabled });
  };

  // New external player functions
  const toggleExternalPlayerEnabled = () => {
    setState((prev) => {
      const newEnabledState = !prev.externalPlayerEnabled;
      const newState = { ...prev, externalPlayerEnabled: newEnabledState };
      if (!newEnabledState) {
        newState.selectedExternalPlayerId = null; // Disable player selection if feature is off
      }
      saveState(newState);
      return newState;
    });
  };

  const setSelectedExternalPlayerId = (id: string | null) => {
    setState((prev) => {
      const newState = { ...prev, selectedExternalPlayerId: id };
      saveState(newState);
      return newState;
    });
  };

  const setFilter = (filter: FilterType) => {
    setState((prev) => {
      const newState = { ...prev, filter };
      saveState(newState);
      return newState;
    });
  };

  const setSort = (sort: SortOption) => {
    setState((prev) => {
      const newState = { ...prev, sort };
      saveState(newState);
      return newState;
    });
  };

  const setShowWatched = (showWatched: boolean) => {
    setState((prev) => {
      const newState = { ...prev, showWatched };
      saveState(newState);
      return newState;
    });
  };

  const setIsSearchFocused = (isSearchFocused: boolean) => {
    setState((prev) => {
      const newState = { ...prev, isSearchFocused };
      saveState(newState);
      return newState;
    });
  };

  const updateMediaMetadata = (id: number, type: 'movie' | 'tv', metadata: Partial<Media>) => {
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
  };

  const toggleWatchlist = async (media: Media) => {
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
  };

  const toggleWatched = async (media: Media, rating?: number) => {
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
  };

  // Effect to backfill missing next_episode_to_air for TV shows in watched list
  useEffect(() => {
    const backfillTVInfo = async () => {
      if (!isLoaded || !state.apiKey || isSyncing) return;
      
      const needsUpdate = state.watched.some(m => m.media_type === 'tv' && m.next_episode_to_air === undefined);
      if (!needsUpdate) return;

      const updatedWatched = await Promise.all(state.watched.map(async (m) => {
        if (m.media_type === 'tv' && m.next_episode_to_air === undefined) {
          try {
            const details = await getMediaDetails(m.id, 'tv', state.apiKey);
            return { ...m, next_episode_to_air: details.next_episode_to_air || null };
          } catch {
            return m;
          }
        }
        return m;
      }));

      const hasChanged = updatedWatched.some((m, i) => m.next_episode_to_air !== state.watched[i].next_episode_to_air);
      if (hasChanged) {
        setState(prev => {
          const newState = { ...prev, watched: updatedWatched };
          saveState(newState);
          return newState;
        });
      }
    };

    backfillTVInfo();
  }, [isLoaded, state.apiKey, isSyncing, state.watched]);

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
        updateMediaMetadata,
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