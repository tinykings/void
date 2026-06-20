import { create } from 'zustand';
import { persist, StateStorage, createJSONStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import { Media, UserState, FilterType, SortOption } from '@/lib/types';
import { buildGistPayload, fromGistItem, getGistContent, isEmptyGistPayload, updateGist } from '@/lib/gist';
import { getMediaDetails } from '@/lib/tmdb';
import { getIgdbGameDetails } from '@/lib/igdb';
import { mapWithConcurrency } from '@/lib/concurrency';
import { getMediaKey, getMediaSource } from '@/lib/media';

const DEFAULT_TMDB_ACCESS_TOKEN = process.env.NEXT_PUBLIC_TMDB_READ_ACCESS_TOKEN || '';
const METADATA_HYDRATION_CONCURRENCY = 1;

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
  isSyncingLibrary: boolean;
  setIsLoaded: (loaded: boolean) => void;
  setIsSyncingLibrary: (syncing: boolean) => void;
  
  setApiKey: (apiKey: string) => void;
  setGistId: (gistId: string) => void;
  setGistToken: (gistToken: string) => void;
  setFilter: (filter: FilterType) => void;
  setSort: (sort: SortOption) => void;
  setShowWatched: (show: boolean) => void;
  setIsSearchFocused: (focused: boolean) => void;

  updateMediaMetadata: (id: number, type: 'movie' | 'tv' | 'game', metadata: Partial<Media>, source?: Media['source']) => void;
  
  markEpisodePlayed: (tmdbId: number, seasonNum: number, episodeNum: number) => void;
  unmarkEpisodePlayed: (tmdbId: number, seasonNum: number, episodeNum: number) => void;

  processTVMigrations: () => Promise<Media[]>;
  toggleWatchlist: (media: Media) => Promise<void>;
  toggleWatched: (media: Media, rating?: number) => Promise<void>;
  toggleFavorite: (media: Media) => Promise<void>;
  setShowFavoritesOnly: (show: boolean) => void;
  
  setLists: (watchlist: Media[], watched: Media[]) => void;
  syncFromGist: (showIndicator?: boolean) => Promise<void>;
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
        filter: 'all',
        sort: 'added',
        showWatched: false,
        showFavoritesOnly: false,
        isSearchFocused: false,
        playedEpisodes: {},
        isLoaded: false,
        isSyncingLibrary: false,

        // Actions
        setIsLoaded: (loaded) => set({ isLoaded: loaded }),
        setIsSyncingLibrary: (isSyncingLibrary) => set({ isSyncingLibrary }),
        
        setApiKey: (apiKey) => set({ apiKey }),

        setGistId: (gistId) => set({ gistId }),

        setGistToken: (gistToken) => set({ gistToken }),
        
        setFilter: (filter) => set({ filter }),
        
        setSort: (sort) => set({ sort }),
        
        setShowWatched: (showWatched) => set({ showWatched }),

        setShowFavoritesOnly: (showFavoritesOnly) => set({ showFavoritesOnly }),
        
        setIsSearchFocused: (isSearchFocused) => set({ isSearchFocused }),

        updateMediaMetadata: (id, type, metadata, source) => set((state) => {
          const updateList = (list: Media[]) => 
            list.map(m => {
              const sameProvider = type !== 'game' || !source || getMediaSource(m) === source;
              return m.id === id && m.media_type === type && sameProvider ? { ...m, ...metadata } : m;
            });
          
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

        syncFromGist: async (showIndicator = false) => {
          const { apiKey, gistId, gistToken, watchlist, watched } = get();
          if (!gistId || !gistToken) return;

          await enqueueGistOperation(async () => {
            if (showIndicator) set({ isSyncingLibrary: true });
            try {
              const gist = await getGistContent(gistId);

              if (isEmptyGistPayload(gist)) {
                await updateGist(gistId, gistToken, buildGistPayload(watchlist, watched));
                return;
              }

              if (!gist) return;

              const favoriteKeys = new Set(gist.favorites.map((item) => getMediaKey(fromGistItem(item))));
              const localWatchlist = gist.watchlist.map((item) => fromGistItem(item));
              const localWatched = gist.watched.map((item) => {
                const media = fromGistItem(item);
                return fromGistItem(item, favoriteKeys.has(getMediaKey(media)));
              });

              const hydrateList = async (items: Media[]) => {
                const hydrated = await mapWithConcurrency(items, METADATA_HYDRATION_CONCURRENCY, async (item) => {
                  try {
                    const source = getMediaSource(item);
                    const details = item.media_type === 'game'
                      ? source === 'steam'
                        ? item
                        : await getIgdbGameDetails(item.id)
                      : await getMediaDetails(item.id, item.media_type, apiKey);
                    return {
                      ...details,
                      date_added: item.date_added,
                      isFavorite: item.isFavorite,
                    } as Media;
                  } catch {
                    return item;
                  }
                });
                return hydrated;
              };

              const [hydratedWatchlist, hydratedWatched] = await Promise.all([
                hydrateList(localWatchlist),
                hydrateList(localWatched),
              ]);

              set({ watchlist: hydratedWatchlist, watched: hydratedWatched });
            } finally {
              if (showIndicator) set({ isSyncingLibrary: false });
            }
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
          const mediaKey = getMediaKey(media);
          const inWatchlist = watchlist.some((m) => getMediaKey(m) === mediaKey);
          
          if (inWatchlist) {
            set({ watchlist: watchlist.filter((m) => getMediaKey(m) !== mediaKey) });
          } else {
            set({ 
              watchlist: [...watchlist, { ...media, date_added: new Date().toISOString() }],
              watched: watched.filter((m) => getMediaKey(m) !== mediaKey)
            });
          }

          void get().syncToGist();
        },

        toggleWatched: async (media, rating) => {
          const { watched, watchlist } = get();
          const mediaKey = getMediaKey(media);
          const inWatched = watched.some((m) => getMediaKey(m) === mediaKey);

          if (inWatched && !rating) {
            set({ watched: watched.filter((m) => getMediaKey(m) !== mediaKey) });
          } else {
            set({
              watched: [...watched, { ...media, date_added: new Date().toISOString(), lastChecked: Date.now() }],
              watchlist: watchlist.filter((m) => getMediaKey(m) !== mediaKey)
            });
          }

          void get().syncToGist();
        },

        toggleFavorite: async (media) => {
          const { watched } = get();
          const mediaKey = getMediaKey(media);
          const item = watched.find((m) => getMediaKey(m) === mediaKey);
          if (!item) return;

          const newIsFavorite = !item.isFavorite;
          set({
            watched: watched.map((m) =>
              getMediaKey(m) === mediaKey
                ? { ...m, isFavorite: newIsFavorite }
                : m
            ),
          });

          void get().syncToGist();
        },

        processTVMigrations: async () => {
          const state = get();
          const { apiKey, watched } = state;

          if (!apiKey || !watched.length) return [];

          const now = Date.now();
          const checkThreshold = 24 * 60 * 60 * 1000;

          const eligible = watched.filter((m) =>
            m.media_type === 'tv' &&
            m.status !== 'Ended' &&
            m.status !== 'Canceled' &&
            (now - (m.lastChecked || 0) > checkThreshold)
          );

          if (!eligible.length) return [];

          const migratedItems: Media[] = [];
          const migratedIds: Set<string> = new Set();
          const metadataUpdates: Map<string, Partial<Media>> = new Map();

          for (const show of eligible) {
            try {
              const details = await getMediaDetails(show.id, 'tv', apiKey);
              const airDateStr = details.next_episode_to_air?.air_date;
              let shouldMigrate = false;

              if (airDateStr) {
                const parts = airDateStr.split('-');
                if (parts.length === 3) {
                  const airDate = new Date(
                    parseInt(parts[0], 10),
                    parseInt(parts[1], 10) - 1,
                    parseInt(parts[2], 10)
                  );
                  if (!isNaN(airDate.getTime())) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const cutoff = new Date(today);
                    cutoff.setDate(today.getDate() + 30);
                    cutoff.setHours(23, 59, 59, 999);

                    if (airDate.getTime() >= today.getTime() && airDate.getTime() <= cutoff.getTime()) {
                      shouldMigrate = true;
                    }
                  }
                }
              }

              if (shouldMigrate) {
                migratedItems.push({ ...show, ...details, lastChecked: now, date_added: new Date().toISOString() });
                migratedIds.add(`${show.id}-${show.media_type}`);
              } else {
                metadataUpdates.set(`${show.id}-${show.media_type}`, {
                  status: details.status,
                  next_episode_to_air: details.next_episode_to_air,
                  lastChecked: now,
                });
              }
            } catch (err) {
              console.error(`Migration check failed for ${show.name || show.title}:`, err);
            }
          }

          set((state) => {
            let newWatched = [...state.watched];
            let newWatchlist = [...state.watchlist];

            if (metadataUpdates.size > 0) {
              newWatched = newWatched.map((m) => {
                const key = `${m.id}-${m.media_type}`;
                const update = metadataUpdates.get(key);
                return update ? { ...m, ...update } : m;
              });
            }

            if (migratedItems.length > 0) {
              newWatched = newWatched.filter((m) => !migratedIds.has(`${m.id}-${m.media_type}`));
              newWatchlist = [...newWatchlist, ...migratedItems];
            }

            return { watched: newWatched, watchlist: newWatchlist };
          });

          if (migratedItems.length > 0) {
            get().syncToGist();
          }

          return migratedItems;
        },

      };
    },
    {
      name: 'void_user_state',
      storage: createJSONStorage(() => storage),
      version: 4,
      migrate: (persistedState, version) => {
        const state = persistedState as Partial<StoreState> | undefined;
        if (!state) return state;

        if (version < 2) {
          state.filter = 'all' as FilterType;
        }

        if (version < 3) {
          const withSource = (items?: Media[]) => (items || []).map((item) => ({
            ...item,
            source: item.source || (item.media_type === 'game' ? 'igdb' : 'tmdb' as const),
          }));

          state.watchlist = withSource(state.watchlist);
          state.watched = withSource(state.watched);
        }

        if (version < 4) {
          const withIgdbDefaults = (items?: Media[]) => (items || []).map((item) => ({
            ...item,
            source: item.source || (item.media_type === 'game' ? 'igdb' : 'tmdb' as const),
          }));

          state.watchlist = withIgdbDefaults(state.watchlist);
          state.watched = withIgdbDefaults(state.watched);
        }

        return state;
      },
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
