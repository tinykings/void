'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Media, UserState, ExternalPlayerOption, externalPlayerOptions } from '@/lib/types';
import { loadState, saveState, toggleInList as toggleInStorage } from '@/lib/storage';
import { fetchGistData, updateGistData } from '@/lib/gist';
import { searchMedia } from '@/lib/tmdb';

interface AppContextType extends UserState {
  setApiKey: (key: string) => void;
  setGithubToken: (token: string) => void;
  setGistId: (id: string) => void;
  setVidAngelEnabled: (enabled: boolean) => void;
  toggleWatchlist: (media: Media) => void;
  toggleWatched: (media: Media) => void;
  syncFromGist: () => Promise<void>;
  isLoaded: boolean;
  isSyncing: boolean;
  recommendations: Media[];
  setRecommendations: (recs: Media[]) => void;
  query: string;
  setQuery: (q: string) => void;
  searchResults: Media[];
  searchLoading: boolean;

  // New external player settings
  externalPlayerEnabled: boolean;
  selectedExternalPlayer: ExternalPlayerOption | null;
  toggleExternalPlayerEnabled: () => void;
  setSelectedExternalPlayerId: (id: string | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<UserState>({
    apiKey: '',
    watchlist: [],
    watched: [],
    githubToken: '',
    gistId: '',
    vidAngelEnabled: false,
    externalPlayerEnabled: false,
    selectedExternalPlayerId: null,
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [recommendations, setRecommendations] = useState<Media[]>([]);

  // Search State
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Media[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const initialLoadDone = useRef(false);

  // Debounced Search
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (query.length > 2 && state.apiKey) {
        setSearchLoading(true);
        searchMedia(query, state.apiKey)
          .then((results) => {
            // Sort by popularity at the top
            const sorted = [...results].sort((a, b) => b.popularity - a.popularity);
            setSearchResults(sorted);
          })
          .catch(console.error)
          .finally(() => setSearchLoading(false));
      } else if (query.length === 0) {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [query, state.apiKey]);

  // Load from local storage on mount
  useEffect(() => {
    const loaded = loadState();
    setState(loaded);
    setIsLoaded(true);

    // Attempt initial sync if credentials exist
    if (loaded.githubToken && loaded.gistId && !initialLoadDone.current) {
      initialLoadDone.current = true;
      syncFromGistInternal(loaded.githubToken, loaded.gistId);
    }
  }, []);

  const syncFromGistInternal = async (token: string, gistId: string) => {
    if (!token || !gistId) return;
    setIsSyncing(true);
    try {
      const data = await fetchGistData(token, gistId);
      if (data && (Array.isArray(data.watchlist) || Array.isArray(data.watched))) {
        setState(prev => {
          const newState = {
            ...prev,
            watchlist: data.watchlist || prev.watchlist,
            watched: data.watched || prev.watched
          };
          saveState(newState);
          return newState;
        });
      }
    } catch (error) {
      console.error("Gist Sync Error:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const syncFromGist = async () => {
    await syncFromGistInternal(state.githubToken || '', state.gistId || '');
  };

  const setApiKey = (apiKey: string) => {
    setState((prev) => ({ ...prev, apiKey }));
    saveState({ ...state, apiKey });
  };

  const setGithubToken = (githubToken: string) => {
    setState((prev) => ({ ...prev, githubToken }));
    saveState({ ...state, githubToken });
  };

  const setGistId = (gistId: string) => {
    setState((prev) => ({ ...prev, gistId }));
    saveState({ ...state, gistId });
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

  const pushToGist = async (watchlist: Media[], watched: Media[]) => {
    if (!state.githubToken || !state.gistId) return;
    try {
      await updateGistData(state.githubToken, state.gistId, { watchlist, watched });
    } catch (error) {
      console.error("Failed to push to Gist", error);
    }
  };

  const toggleWatchlist = (media: Media) => {
    const newState = toggleInStorage(media, 'watchlist');
    setState(newState);
    pushToGist(newState.watchlist, newState.watched);
  };

  const toggleWatched = (media: Media) => {
    const newState = toggleInStorage(media, 'watched');
    setState(newState);
    pushToGist(newState.watchlist, newState.watched);
  };

  // Derive selectedExternalPlayer from selectedExternalPlayerId
  const selectedExternalPlayer = state.selectedExternalPlayerId
    ? externalPlayerOptions.find(opt => opt.id === state.selectedExternalPlayerId) || null
    : null;

  return (
    <AppContext.Provider
      value={{
        ...state,
        setApiKey,
        setGithubToken,
        setGistId,
        setVidAngelEnabled,
        toggleWatchlist,
        toggleWatched,
        syncFromGist,
        isLoaded,
        isSyncing,
        recommendations,
        setRecommendations,
        query,
        setQuery,
        searchResults,
        searchLoading,
        // New values
        externalPlayerEnabled: state.externalPlayerEnabled || false,
        selectedExternalPlayer,
        toggleExternalPlayerEnabled,
        setSelectedExternalPlayerId,
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