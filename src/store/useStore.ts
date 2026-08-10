import { create } from 'zustand';
import { persist, StateStorage, createJSONStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import { Media, UserState, FilterType, SortOption } from '@/lib/types';
import { buildGistPayload, fromGistItem, getGistContent, updateGist, type GistLibraryData } from '@/lib/gist';
import { mergeGistChanges } from '@/lib/gistMerge';
import { getMediaDetails } from '@/lib/tmdb';
import { getIgdbGameDetails } from '@/lib/igdb';
import { mapWithConcurrency } from '@/lib/concurrency';
import { getMediaKey, getMediaSource } from '@/lib/media';
import { isDateInLocalDayWindow, toggleFavoriteInLibrary, togglePurchasedInLibrary, toggleWatchedInLibrary, toggleWatchlistInLibrary } from '@/lib/library';

const DEFAULT_TMDB_ACCESS_TOKEN = process.env.NEXT_PUBLIC_TMDB_READ_ACCESS_TOKEN || '';
const METADATA_HYDRATION_CONCURRENCY = 1;
const TV_MIGRATION_WINDOW_DAYS = 7;

let gistQueue: Promise<void> = Promise.resolve();
const gistBaselines = new Map<string, GistLibraryData>();

const getGistConnectionKey = (gistId: string, githubLogin: string) => `${githubLogin}:${gistId}`;
const sameGistPayload = (left: GistLibraryData, right: GistLibraryData) =>
  JSON.stringify(left) === JSON.stringify(right);

const materializeGistPayload = (payload: GistLibraryData, existingItems: Media[]) => {
  const existingByKey = new Map(existingItems.map((item) => [getMediaKey(item), item]));
  const favorites = new Set(payload.favorites.map((item) => getMediaKey(fromGistItem(item))));
  const materialize = (item: GistLibraryData['watchlist'][number]) => {
    const synced = fromGistItem(item, favorites.has(getMediaKey(fromGistItem(item))));
    const existing = existingByKey.get(getMediaKey(synced));
    if (!existing) return synced;

    return {
      ...synced,
      ...existing,
      title: synced.title,
      name: synced.name,
      date_added: synced.date_added,
      release_date: synced.release_date,
      rating: synced.rating,
      isFavorite: synced.isFavorite,
      isPurchased: synced.isPurchased,
    };
  };

  return {
    watchlist: payload.watchlist.map(materialize),
    watched: payload.watched.map(materialize),
  };
};

const enqueueGistOperation = (operation: () => Promise<void>) => {
  const result = gistQueue.then(operation);
  gistQueue = result.catch((error) => {
    console.error('Gist sync error:', error);
  });
  return result;
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
  setGithubConnection: (gistId: string, gistToken: string, githubLogin: string) => void;
  disconnectGithub: () => void;
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
  togglePurchased: (media: Media) => Promise<void>;
  setShowFavoritesOnly: (show: boolean) => void;
  
  setLists: (watchlist: Media[], watched: Media[], playedEpisodes?: Record<string, boolean>) => void;
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
        githubLogin: '',
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

        setGithubConnection: (gistId, gistToken, githubLogin) => set({ gistId, gistToken, githubLogin }),

        disconnectGithub: () => set({ gistId: '', gistToken: '', githubLogin: '' }),
        
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

        markEpisodePlayed: (tmdbId, seasonNum, episodeNum) => {
          set((state) => ({
            playedEpisodes: { ...state.playedEpisodes, [`${tmdbId}-${seasonNum}-${episodeNum}`]: true },
          }));
          void get().syncToGist();
        },

        unmarkEpisodePlayed: (tmdbId, seasonNum, episodeNum) => {
          set((state) => {
            const key = `${tmdbId}-${seasonNum}-${episodeNum}`;
            const newPlayedEpisodes = { ...state.playedEpisodes };
            delete newPlayedEpisodes[key];
            return { playedEpisodes: newPlayedEpisodes };
          });
          void get().syncToGist();
        },

        setLists: (watchlist, watched, playedEpisodes) => set((state) => ({
          watchlist,
          watched,
          playedEpisodes: playedEpisodes ?? state.playedEpisodes,
        })),

        syncFromGist: async (showIndicator = false) => {
          const { apiKey, gistId, gistToken, githubLogin, watchlist, watched, playedEpisodes } = get();
          if (!gistId || !gistToken || !githubLogin) return;

          const connectionKey = getGistConnectionKey(gistId, githubLogin);
          if (!gistBaselines.has(connectionKey)) {
            gistBaselines.set(connectionKey, buildGistPayload(watchlist, watched, playedEpisodes));
          }

          await enqueueGistOperation(async () => {
            if (showIndicator) set({ isSyncingLibrary: true });
            try {
              const gistResult = await getGistContent(gistId, gistToken);

              if (gistResult.status === 'invalid') {
                throw new Error(`Gist sync stopped: ${gistResult.reason}`);
              }

              if (gistResult.status === 'missing' || gistResult.status === 'empty') {
                const latest = get();
                const payload = buildGistPayload(latest.watchlist, latest.watched, latest.playedEpisodes);
                await updateGist(gistId, gistToken, payload);
                gistBaselines.set(connectionKey, payload);
                return;
              }

              const gist = gistResult.data;
              const favoriteKeys = new Set(gist.favorites.map((item) => getMediaKey(fromGistItem(item))));
              const remoteWatchlist = gist.watchlist.map((item) => fromGistItem(item));
              const remoteWatched = gist.watched.map((item) => {
                const media = fromGistItem(item);
                return fromGistItem(item, favoriteKeys.has(getMediaKey(media)));
              });

              const hydrateList = async (items: Media[]) => mapWithConcurrency(
                items,
                METADATA_HYDRATION_CONCURRENCY,
                async (item) => {
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
                      isPurchased: item.isPurchased,
                      rating: item.rating,
                    } as Media;
                  } catch {
                    return item;
                  }
                },
              );

              const [hydratedWatchlist, hydratedWatched] = await Promise.all([
                hydrateList(remoteWatchlist),
                hydrateList(remoteWatched),
              ]);
              const latest = get();
              const baseline = gistBaselines.get(connectionKey)
                ?? buildGistPayload(latest.watchlist, latest.watched, latest.playedEpisodes);
              const localPayload = buildGistPayload(latest.watchlist, latest.watched, latest.playedEpisodes);
              const mergedPayload = mergeGistChanges(gist, baseline, localPayload);
              const mergedLists = materializeGistPayload(
                mergedPayload,
                [...latest.watchlist, ...latest.watched, ...hydratedWatchlist, ...hydratedWatched],
              );

              set({
                ...mergedLists,
                playedEpisodes: mergedPayload.playedEpisodes ?? {},
              });

              if (gist.version < 4 || !sameGistPayload(gist, mergedPayload)) {
                const payload = buildGistPayload(
                  mergedLists.watchlist,
                  mergedLists.watched,
                  mergedPayload.playedEpisodes ?? {},
                );
                await updateGist(gistId, gistToken, payload);
                gistBaselines.set(connectionKey, payload);
              } else {
                gistBaselines.set(connectionKey, gist);
              }
            } finally {
              if (showIndicator) set({ isSyncingLibrary: false });
            }
          });
        },

        syncToGist: async () => {
          const { gistId, gistToken, githubLogin } = get();
          if (!gistId || !gistToken || !githubLogin) return;

          const connectionKey = getGistConnectionKey(gistId, githubLogin);
          await enqueueGistOperation(async () => {
            const gistResult = await getGistContent(gistId, gistToken);
            if (gistResult.status === 'invalid') {
              throw new Error(`Gist sync stopped: ${gistResult.reason}`);
            }

            const latest = get();
            const localPayload = buildGistPayload(latest.watchlist, latest.watched, latest.playedEpisodes);
            const baseline = gistBaselines.get(connectionKey) ?? localPayload;
            const mergedPayload = gistResult.status === 'loaded'
              ? mergeGistChanges(gistResult.data, baseline, localPayload)
              : localPayload;
            const mergedLists = materializeGistPayload(
              mergedPayload,
              [...latest.watchlist, ...latest.watched],
            );

            set({ ...mergedLists, playedEpisodes: mergedPayload.playedEpisodes ?? {} });
            if (gistResult.status !== 'loaded' || !sameGistPayload(gistResult.data, mergedPayload)) {
              await updateGist(gistId, gistToken, mergedPayload);
            }
            gistBaselines.set(connectionKey, mergedPayload);
          });
        },

        toggleWatchlist: async (media) => {
          const { watchlist, watched } = get();
          set(toggleWatchlistInLibrary(watchlist, watched, media));
          void get().syncToGist();
        },

        toggleWatched: async (media, rating) => {
          const { watched, watchlist } = get();
          set(toggleWatchedInLibrary(watchlist, watched, media, rating));
          void get().syncToGist();
        },

        toggleFavorite: async (media) => {
          const { watchlist, watched } = get();
          const updated = toggleFavoriteInLibrary(watchlist, watched, media);
          if (updated.watchlist === watchlist && updated.watched === watched) return;

          set(updated);
          void get().syncToGist();
        },

        togglePurchased: async (media) => {
          const { watchlist, watched } = get();
          const updated = togglePurchasedInLibrary(watchlist, watched, media);
          if (updated.watchlist === watchlist) return;

          set(updated);
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
                shouldMigrate = isDateInLocalDayWindow(airDateStr, new Date(), TV_MIGRATION_WINDOW_DAYS);
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
      version: 5,
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

        if (version < 5) {
          state.githubLogin = '';
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
                  rehydratedState.setLists(
                    parsed.state.watchlist || [],
                    parsed.state.watched || [],
                    parsed.state.playedEpisodes || {},
                  );
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
