'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Media, UserState } from '@/lib/types';
import { loadState, saveState, toggleInList as toggleInStorage } from '@/lib/storage';

interface AppContextType extends UserState {
  setApiKey: (key: string) => void;
  toggleWatchlist: (media: Media) => void;
  toggleWatched: (media: Media) => void;
  isLoaded: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<UserState>({
    apiKey: '',
    watchlist: [],
    watched: [],
  });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setState(loadState());
    setIsLoaded(true);
  }, []);

  const setApiKey = (apiKey: string) => {
    setState((prev) => ({ ...prev, apiKey }));
    saveState({ apiKey });
  };

  const toggleWatchlist = (media: Media) => {
    const newState = toggleInStorage(media, 'watchlist');
    setState(newState);
  };

  const toggleWatched = (media: Media) => {
    const newState = toggleInStorage(media, 'watched');
    setState(newState);
  };

  return (
    <AppContext.Provider
      value={{
        ...state,
        setApiKey,
        toggleWatchlist,
        toggleWatched,
        isLoaded,
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
