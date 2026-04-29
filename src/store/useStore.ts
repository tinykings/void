import { create } from 'zustand';
import { persist, StateStorage, createJSONStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import { Media, UserState, FilterType, SortOption } from '@/lib/types';
import { buildGistPayload, fromGistItem, getGistContent, isEmptyGistPayload, updateGist } from '@/lib/gist';
import { getMediaDetails } from '@/lib/tmdb';

const DEFAULT_TMDB_ACCESS_TOKEN = process.env.NEXT_PUBLIC_TMDB_READ_ACCESS_TOKEN || '';

let gistQueue: Promise<void> = Promise.resolve();

const enqueueGistOperation = (operation: () => Promise<void>) => {
  gistQueue = gistQueue.then(operation).catch((error) => {
    console.error('Gist sync error:', error);
  });
  return gistQueue;
};

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
  setIsLoaded: (loaded: boolean) => void;
  
  setApiKey: (apiKey: string) => void;
  setGistId: (gistId: string) => void;
  setGistToken: (gistToken: string) => void;
  setVidAngelEnabled: (enabled: boolean) => void;
  setFilter: (filter: FilterType) => void;
  setSort: (sort: SortOption) => void;
  setShowWatched: (show: boolean) => void;
  setIsSearchFocused: (focused: boolean) => void;

  setMediaEditedStatus: (id: number, type: 'movie' | 'tv', isEdited: boolean) => void;
  updateMediaMetadata: (id: number, type: 'movie' | 'tv', metadata: Partial<Media>) => void;
  
  markEpisodePlayed: (tmdbId: number, seasonNum: number, episodeNum: number) => void;
  unmarkEpisodePlayed: (tmdbId: number, seasonNum: number, episodeNum: number) => void;

  toggleWatchlist: (media: Media) => Promise<void>;
  toggleWatched: (media: Media, rating?: number) => Promise<void>;
  toggleFavorite: (media: Media) => Promise<void>;
  setShowFavoritesOnly: (show: boolean) => void;
  
  setLists: (watchlist: Media[], watched: Media[]) => void;
  syncFromGist: (force?: boolean) => Promise<void>;
  syncToGist: () => Promise<void>;

}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => {
      return {
        // Initial State
        apiKey: DEFAULT_TMDB_ACCESS_TOKEN,
        watchlist: [],
        watched: [],
        gistId: '',
        gistToken: '',
        vidAngelEnabled: false,
        filter: 'movie',
        sort: 'added',
        showWatched: false,
        showFavoritesOnly: false,
        isSearchFocused: false,
        editedStatusMap: {},
        playedEpisodes: {},
        isLoaded: false,

        // Actions
        setIsLoaded: (loaded) => set({ isLoaded: loaded }),
        
        setApiKey: (apiKey) => set({ apiKey }),

        setGistId: (gistId) => set({ gistId }),

        setGistToken: (gistToken) => set({ gistToken }),
        
        setVidAngelEnabled: (vidAngelEnabled) => set({ vidAngelEnabled }),
        
        setFilter: (filter) => set({ filter }),
        
        setSort: (sort) => set({ sort }),
        
        setShowWatched: (showWatched) => set({ showWatched }),

        setShowFavoritesOnly: (showFavoritesOnly) => set({ showFavoritesOnly }),
        
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

        markEpisodePlayed: (tmdbId, seasonNum, episodeNum) => set((state) => ({
          playedEpisodes: { ...state.playedEpisodes, [`${tmdbId}-${seasonNum}-${episodeNum}`]: true }
        })),

        unmarkEpisodePlayed: (tmdbId, seasonNum, episodeNum) => set((state) => {
          const key = `${tmdbId}-${seasonNum}-${episodeNum}`;
          const newPlayedEpisodes = { ...state.playedEpisodes };
          delete newPlayedEpisodes[key];
          return { playedEpisodes: newPlayedEpisodes };
        }),

        setLists: (watchlist, watched) => set({ watchlist, watched }),

        syncFromGist: async () => {
          const { apiKey, gistId, gistToken, watchlist, watched } = get();
          if (!gistId || !gistToken) return;

          await enqueueGistOperation(async () => {
            const gist = await getGistContent(gistId);

            if (isEmptyGistPayload(gist)) {
              await updateGist(gistId, gistToken, buildGistPayload(watchlist, watched));
              return;
            }

            if (!gist) return;

            const favoriteKeys = new Set(gist.favorites.map((item) => `${item.media_type}-${item.id}`));
            const localWatchlist = gist.watchlist.map((item) => fromGistItem(item));
            const localWatched = gist.watched.map((item) => fromGistItem(item, favoriteKeys.has(`${item.media_type}-${item.id}`)));

            const hydrateList = async (items: Media[]) => {
              const hydrated = await Promise.all(items.map(async (item) => {
                try {
                  const details = await getMediaDetails(item.id, item.media_type, apiKey);
                  return {
                    ...details,
                    date_added: item.date_added,
                    isFavorite: item.isFavorite,
                  } as Media;
                } catch {
                  return item;
                }
              }));
              return hydrated;
            };

            const [hydratedWatchlist, hydratedWatched] = await Promise.all([
              hydrateList(localWatchlist),
              hydrateList(localWatched),
            ]);

            set({ watchlist: hydratedWatchlist, watched: hydratedWatched });
          });
        },

        syncToGist: async () => {
          const { gistId, gistToken, watchlist, watched } = get();
          if (!gistId || !gistToken) return;

          await enqueueGistOperation(async () => {
            await updateGist(gistId, gistToken, buildGistPayload(watchlist, watched));
          });
        },

        toggleWatchlist: async (media) => {
          const { watchlist, watched } = get();
          const inWatchlist = watchlist.some((m) => m.id === media.id && m.media_type === media.media_type);
          
          if (inWatchlist) {
            set({ watchlist: watchlist.filter((m) => !(m.id === media.id && m.media_type === media.media_type)) });
          } else {
            set({ 
              watchlist: [...watchlist, { ...media, date_added: new Date().toISOString() }],
              watched: watched.filter((m) => !(m.id === media.id && m.media_type === media.media_type))
            });
          }

          void get().syncToGist();
        },

        toggleWatched: async (media, rating) => {
          const { watched, watchlist } = get();
          const inWatched = watched.some((m) => m.id === media.id && m.media_type === media.media_type);

          if (inWatched && !rating) {
            set({ watched: watched.filter((m) => !(m.id === media.id && m.media_type === media.media_type)) });
          } else {
            set({
              watched: [...watched, { ...media, date_added: new Date().toISOString(), lastChecked: Date.now() }],
              watchlist: watchlist.filter((m) => !(m.id === media.id && m.media_type === media.media_type))
            });
          }

          void get().syncToGist();
        },

        toggleFavorite: async (media) => {
          const { watched } = get();
          const item = watched.find((m) => m.id === media.id && m.media_type === media.media_type);
          if (!item) return;

          const newIsFavorite = !item.isFavorite;
          set({
            watched: watched.map((m) =>
              m.id === media.id && m.media_type === media.media_type
                ? { ...m, isFavorite: newIsFavorite }
                : m
            ),
          });

          void get().syncToGist();
        },

      };
    },
    {
      name: 'void_user_state',
      storage: createJSONStorage(() => storage),
        onRehydrateStorage: () => {
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
                const parsed = JSON.parse(localData) as { state: Partial<StoreState> };
                if (parsed.state) {
                  // Merge localStorage data into current store
                  if (parsed.state.apiKey) rehydratedState.setApiKey(parsed.state.apiKey);
                  if (parsed.state.gistId) rehydratedState.setGistId(parsed.state.gistId);
                  if (parsed.state.gistToken) rehydratedState.setGistToken(parsed.state.gistToken);
                  rehydratedState.setLists(parsed.state.watchlist || [], parsed.state.watched || []);
                  console.log('Successfully migrated data from localStorage to IndexedDB');
                }
              } catch (e) {
                console.error('Failed to migrate localStorage data', e);
              }
            }
          }
          if (DEFAULT_TMDB_ACCESS_TOKEN) {
            rehydratedState?.setApiKey(DEFAULT_TMDB_ACCESS_TOKEN);
          }
          rehydratedState?.setIsLoaded(true);
        };
      },
    }
  )
);
