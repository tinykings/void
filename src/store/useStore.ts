import { create } from 'zustand';
import { persist, StateStorage, createJSONStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import { Media, UserState, FilterType, SortOption } from '@/lib/types';
import { getMediaDetails, createRequestToken, createSession, getAccountDetails, getAccountLists, toggleWatchlistStatus, rateMedia, deleteRating } from '@/lib/tmdb';

// Custom storage object for IndexedDB
const storage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (typeof window === 'undefined') return null;
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (typeof window === 'undefined') return;
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    if (typeof window === 'undefined') return;
    await del(name);
  },
};

interface StoreState extends UserState {
  isLoaded: boolean;
  isSyncing: boolean;
  setIsLoaded: (loaded: boolean) => void;
  setIsSyncing: (syncing: boolean) => void;
  
  setApiKey: (apiKey: string) => void;
  setVidAngelEnabled: (enabled: boolean) => void;
  toggleExternalPlayerEnabled: () => void;
  setSelectedExternalPlayerId: (id: string | null) => void;
  setFilter: (filter: FilterType) => void;
  setSort: (sort: SortOption) => void;
  setShowWatched: (show: boolean) => void;
  setShowEditedOnly: (show: boolean) => void;
  setIsSearchFocused: (focused: boolean) => void;
  
  setMediaEditedStatus: (id: number, type: 'movie' | 'tv', isEdited: boolean) => void;
  updateMediaMetadata: (id: number, type: 'movie' | 'tv', metadata: Partial<Media>) => void;
  
  // TMDB Sync & Auth
  loginWithTMDB: () => Promise<void>;
  logoutTMDB: () => void;
  syncFromTMDB: (force?: boolean) => Promise<void>;
  processTVMigrations: () => Promise<void>;
  
  toggleWatchlist: (media: Media) => Promise<void>;
  toggleWatched: (media: Media, rating?: number) => Promise<void>;
  
  setSession: (sessionId: string, accountId: number) => void;
  setLists: (watchlist: Media[], watched: Media[]) => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => {
      const lastSyncTime = { current: 0 };

      const syncFromTMDBInternal = async (apiKey: string, sessionId: string, accountId: number) => {
        const now = Date.now();
        if (now - lastSyncTime.current < 30000 && lastSyncTime.current !== 0) {
          return;
        }
        
        set({ isSyncing: true });
        try {
          const fetchAll = async (type: 'movies' | 'tv', list: 'watchlist' | 'rated'): Promise<Media[]> => {
            const firstPage = await getAccountLists(apiKey, sessionId, accountId, type, list, 1);
            let allItems = [...firstPage.results];
            const totalPages = firstPage.totalPages;

            if (totalPages > 1) {
              const pagePromises = [];
              for (let p = 2; p <= totalPages; p++) {
                pagePromises.push(getAccountLists(apiKey, sessionId, accountId, type, list, p));
              }
              const otherPages = await Promise.all(pagePromises);
              otherPages.forEach(page => {
                allItems = [...allItems, ...page.results];
              });
            }
            return allItems;
          };

          const [wlMovies, wlTv, ratedMovies, ratedTv] = await Promise.all([
            fetchAll('movies', 'watchlist'),
            fetchAll('tv', 'watchlist'),
            fetchAll('movies', 'rated'),
            fetchAll('tv', 'rated'),
          ]);

          set({ 
            watchlist: [...wlMovies, ...wlTv],
            watched: [...ratedMovies, ...ratedTv]
          });
          lastSyncTime.current = Date.now();
        } catch (error) {
          console.error("TMDB Sync Error:", error);
        } finally {
          set({ isSyncing: false });
        }
      };

      return {
        // Initial State
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
        isLoaded: false,
        isSyncing: false,

        // Actions
        setIsLoaded: (loaded) => set({ isLoaded: loaded }),
        setIsSyncing: (syncing) => set({ isSyncing: syncing }),
        
        setApiKey: (apiKey) => set({ apiKey }),
        
        setVidAngelEnabled: (vidAngelEnabled) => set({ vidAngelEnabled }),
        
        toggleExternalPlayerEnabled: () => set((state) => {
          const newEnabledState = !state.externalPlayerEnabled;
          return { 
            externalPlayerEnabled: newEnabledState,
            selectedExternalPlayerId: newEnabledState ? state.selectedExternalPlayerId : null
          };
        }),
        
        setSelectedExternalPlayerId: (id) => set({ selectedExternalPlayerId: id }),
        
        setFilter: (filter) => set({ filter }),
        
        setSort: (sort) => set({ sort }),
        
        setShowWatched: (showWatched) => set({ showWatched }),
        
        setShowEditedOnly: (showEditedOnly) => set({ showEditedOnly }),
        
        setIsSearchFocused: (isSearchFocused) => set({ isSearchFocused }),

        setMediaEditedStatus: (id, type, isEdited) => set((state) => {
          const key = `${type}-${id}`;
          return {
            editedStatusMap: { ...state.editedStatusMap, [key]: isEdited }
          };
        }),

        updateMediaMetadata: (id, type, metadata) => set((state) => {
          const updateList = (list: Media[]) => 
            list.map(m => m.id === id && m.media_type === type ? { ...m, ...metadata } : m);
          
          return {
            watchlist: updateList(state.watchlist),
            watched: updateList(state.watched)
          };
        }),

        setSession: (tmdbSessionId, tmdbAccountId) => set({ tmdbSessionId, tmdbAccountId }),
        setLists: (watchlist, watched) => set({ watchlist, watched }),

        loginWithTMDB: async () => {
          const { apiKey } = get();
          if (!apiKey) return;
          try {
            const token = await createRequestToken(apiKey);
            localStorage.setItem('tmdb_request_token', token);
            const redirectUrl = `${window.location.origin}${window.location.pathname}`;
            window.location.href = `https://www.themoviedb.org/authenticate/${token}?redirect_to=${encodeURIComponent(redirectUrl)}`;
          } catch (error) {
            console.error("Failed to start TMDB login:", error);
          }
        },

        logoutTMDB: () => set({
          tmdbSessionId: undefined,
          tmdbAccountId: undefined,
          watchlist: [],
          watched: []
        }),

        syncFromTMDB: async (force = false) => {
          const { apiKey, tmdbSessionId, tmdbAccountId } = get();
          if (apiKey && tmdbSessionId && tmdbAccountId) {
            if (force) lastSyncTime.current = 0;
            await syncFromTMDBInternal(apiKey, tmdbSessionId, tmdbAccountId);
          }
        },

        processTVMigrations: async () => {
          const { apiKey, tmdbSessionId, tmdbAccountId, watched, isSyncing, isLoaded } = get();
          if (!isLoaded || !apiKey || isSyncing || !tmdbSessionId || !tmdbAccountId) return;
          
          const now = Date.now();
          const checkThreshold = 24 * 60 * 60 * 1000;
          const showsToProcess = watched.filter(m => 
            m.media_type === 'tv' && 
            m.status !== 'Ended' && 
            m.status !== 'Canceled' &&
            (now - (m.lastChecked || 0) > checkThreshold)
          );

          if (showsToProcess.length === 0) return;

          let changed = false;
          const updatedWatched = [...watched];

          for (const show of showsToProcess) {
            try {
              const details = await getMediaDetails(show.id, 'tv', apiKey);
              const idx = updatedWatched.findIndex(m => m.id === show.id && m.media_type === 'tv');
              if (idx === -1) continue;

              if (details.next_episode_to_air) {
                await toggleWatchlistStatus(apiKey, tmdbSessionId, tmdbAccountId, show.id, 'tv', true);
                await deleteRating(apiKey, tmdbSessionId, show.id, 'tv');
                updatedWatched.splice(idx, 1);
                changed = true;
              } else {
                updatedWatched[idx] = { 
                  ...updatedWatched[idx], 
                  status: details.status,
                  next_episode_to_air: null,
                  lastChecked: now 
                };
                changed = true;
              }
            } catch (err) { console.error(err); }
          }

          if (changed) {
            set({ watched: updatedWatched });
            const { syncFromTMDB } = get();
            syncFromTMDB(true);
          }
        },

        toggleWatchlist: async (media) => {
          const { apiKey, tmdbSessionId, tmdbAccountId, watchlist } = get();
          const inWatchlist = watchlist.some((m) => m.id === media.id && m.media_type === media.media_type);
          
          if (inWatchlist && !window.confirm(`Remove "${media.title || media.name}" from your watchlist?`)) return;

          const newWatchlist = inWatchlist
            ? watchlist.filter((m) => !(m.id === media.id && m.media_type === media.media_type))
            : [...watchlist, { ...media, date_added: new Date().toISOString() }];
          
          set({ watchlist: newWatchlist });

          if (apiKey && tmdbSessionId && tmdbAccountId) {
            try {
              await toggleWatchlistStatus(apiKey, tmdbSessionId, tmdbAccountId, media.id, media.media_type, !inWatchlist);
            } catch (err) { console.error(err); }
          }
        },

        toggleWatched: async (media, rating) => {
          const { apiKey, tmdbSessionId, tmdbAccountId, watched, watchlist } = get();
          const inWatched = watched.some((m) => m.id === media.id && m.media_type === media.media_type);
          
          if (inWatched && !rating && !window.confirm(`Remove "${media.title || media.name}" from history?`)) return;

          if (inWatched && !rating) {
            set({ watched: watched.filter((m) => !(m.id === media.id && m.media_type === media.media_type)) });
            if (apiKey && tmdbSessionId && tmdbAccountId) {
              try { await deleteRating(apiKey, tmdbSessionId, media.id, media.media_type); } catch (err) { console.error(err); }
            }
          } else {
            set({
              watched: [...watched, { ...media, date_added: new Date().toISOString() }],
              watchlist: watchlist.filter((m) => !(m.id === media.id && m.media_type === media.media_type))
            });
            if (apiKey && tmdbSessionId && tmdbAccountId) {
              try { await rateMedia(apiKey, tmdbSessionId, media.id, media.media_type, rating || 1); } catch (err) { console.error(err); }
            }
          }
        }
      };
    },
    {
      name: 'void_user_state',
      storage: createJSONStorage(() => storage),
      onRehydrateStorage: (state) => {
        // Migration bridge: If IndexedDB is empty, try to import from localStorage
        return async (rehydratedState, error) => {
          if (error) {
            console.error('Rehydration error:', error);
            return;
          }
          
          // If the rehydrated state from IDB is empty/default, check localStorage
          if (rehydratedState && !rehydratedState.apiKey && typeof window !== 'undefined') {
            const localData = localStorage.getItem('void_user_state');
            if (localData) {
              try {
                const parsed = JSON.parse(localData);
                if (parsed.state) {
                  // Merge localStorage data into current store
                  rehydratedState.setApiKey(parsed.state.apiKey);
                  if (parsed.state.tmdbSessionId) {
                    rehydratedState.setSession(parsed.state.tmdbSessionId, parsed.state.tmdbAccountId);
                  }
                  rehydratedState.setLists(parsed.state.watchlist || [], parsed.state.watched || []);
                  console.log('Successfully migrated data from localStorage to IndexedDB');
                }
              } catch (e) {
                console.error('Failed to migrate localStorage data', e);
              }
            }
          }
          rehydratedState?.setIsLoaded(true);
        };
      },
    }
  )
);
