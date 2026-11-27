import { create } from 'zustand';
import { persist, StateStorage, createJSONStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import { Media, UserState, FilterType, SortOption } from '@/lib/types';
import { buildGistPayload, fromGistItem, getGistContent, updateGist, type GistLibraryData } from '@/lib/gist';
import { mergeGistChanges } from '@/lib/gistMerge';
import { getMediaDetails } from '@/lib/tmdb';
import { createMetadataRefresher, mergeMediaMetadata } from '@/lib/metadataRefresh';
import { getMediaKey, getMediaSource } from '@/lib/media';
import { applyReturningShowCheck, toggleFavoriteInLibrary, toggleWatchedInLibrary, toggleWatchlistInLibrary } from '@/lib/library';

const DEFAULT_TMDB_ACCESS_TOKEN = process.env.NEXT_PUBLIC_TMDB_READ_ACCESS_TOKEN || '';

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
    const hasCachedDetails = typeof existing.metadataFetchedAt === 'number';

    return {
      ...synced,
      ...existing,
      title: hasCachedDetails ? existing.title ?? synced.title : synced.title,
      name: hasCachedDetails ? existing.name ?? existing.title ?? synced.name : synced.name,
      date_added: synced.date_added,
      release_date: hasCachedDetails ? existing.release_date : synced.release_date,
      poster_path: existing.poster_path || synced.poster_path,
      backdrop_path: existing.backdrop_path || synced.backdrop_path,
      rating: synced.rating,
      isFavorite: synced.isFavorite,
      isPurchased: synced.isPurchased,
      pinnedAt: synced.pinnedAt,
      returnedFor: synced.returnedFor,
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
  togglePin: (media: Media) => void;
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

  refreshLibraryMetadata: () => Promise<Media[]>;
  processTVMigrations: () => Promise<Media[]>;
  toggleWatchlist: (media: Media) => Promise<void>;
  toggleWatched: (media: Media, rating?: number) => Promise<void>;
  toggleFavorite: (media: Media) => Promise<void>;
  setShowFavoritesOnly: (show: boolean) => void;
  
  setLists: (watchlist: Media[], watched: Media[], playedEpisodes?: Record<string, boolean>) => void;
  syncFromGist: (showIndicator?: boolean) => Promise<void>;
  syncToGist: () => Promise<void>;

}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => {
      const refreshMetadata = createMetadataRefresher({
        snapshot: get,
        canRefresh: () => (typeof navigator === 'undefined' || navigator.onLine !== false)
          && (typeof document === 'undefined' || document.visibilityState === 'visible'),
        fetchDetails: (item, apiKey) => item.media_type === 'game'
          ? Promise.resolve(item) : getMediaDetails(item.id, item.media_type, apiKey),
        apply: (entry, details, fetchedAt, checkReturn, apiKey) => {
          let returned: Media | undefined;
          set((latest) => {
            if (latest.apiKey !== apiKey) return latest;
            const key = getMediaKey(entry.item);
            const current = [...latest.watchlist, ...latest.watched].find((item) => getMediaKey(item) === key);
            if (!current) return latest; // Never resurrect a title removed while loading.
            const hasNewerDetails = (current.metadataFetchedAt ?? 0) > (entry.item.metadataFetchedAt ?? 0);
            const refreshed = hasNewerDetails ? current : mergeMediaMetadata(current, details, fetchedAt);
            const update = (items: Media[]) => items.map((item) => getMediaKey(item) === key ? refreshed : item);
            const watchlist = update(latest.watchlist);
            const watched = update(latest.watched);
            if (checkReturn) {
              const result = applyReturningShowCheck(watchlist, watched, entry.item, refreshed);
              returned = result.returned;
              return { watchlist: result.watchlist, watched: result.watched };
            }
            return { watchlist, watched };
          });
          return returned;
        },
        onError: (error) => console.error('Library metadata refresh failed:', error),
      });
      return {
        // Initial State
        togglePin: (media) => {
          const key = getMediaKey(media);
          set((state) => ({ watchlist: state.watchlist.map((item) => getMediaKey(item) === key
            ? { ...item, pinnedAt: item.pinnedAt ? undefined : new Date().toISOString() }
            : item) }));
          void get().syncToGist();
        },
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
              return m.id === id && m.media_type === type && sameProvider
                ? mergeMediaMetadata(m, metadata, metadata.metadataFetchedAt ?? Date.now()) : m;
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
          const { gistId, gistToken, githubLogin, watchlist, watched, playedEpisodes } = get();
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
              // Sync library state only. The age-aware queue hydrates new/stale titles
              // afterwards, without re-fetching the whole library on every Gist read.
              const latest = get();
              const baseline = gistBaselines.get(connectionKey)
                ?? buildGistPayload(latest.watchlist, latest.watched, latest.playedEpisodes);
              const localPayload = buildGistPayload(latest.watchlist, latest.watched, latest.playedEpisodes);
              const mergedPayload = mergeGistChanges(gist, baseline, localPayload);
              const mergedLists = materializeGistPayload(
                mergedPayload,
                [...latest.watchlist, ...latest.watched],
              );

              set({
                ...mergedLists,
                playedEpisodes: mergedPayload.playedEpisodes ?? {},
              });

              if (gist.version < 6 || !sameGistPayload(gist, mergedPayload)) {
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

        refreshLibraryMetadata: async () => {
          const migrated = await refreshMetadata();
          if (migrated.length > 0) void get().syncToGist();
          return migrated;
        },

        // Retained for callers/tests; return checks share the same queue and cache.
        processTVMigrations: () => get().refreshLibraryMetadata(),

      };
    },
    {
      name: 'void_user_state',
      storage: createJSONStorage(() => storage),
      version: 6,
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

        // UI migration only: never remove saved items or favorites from either list.
        if (version < 6 && state.filter === 'game') state.filter = 'all';

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
