import { create } from 'zustand';
import { persist, StateStorage, createJSONStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import { Media, UserState, FilterType, SortOption } from '@/lib/types';
import { getMediaDetails, createRequestToken, createSession, getAccountDetails, getAccountLists, toggleWatchlistStatus, rateMedia, deleteRating } from '@/lib/tmdb';
import { toast } from 'sonner';

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
  setOnboardingCompleted: (completed: boolean) => void;
  
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

  // Gist Backup
  setGistBackupConfig: (id: string, token: string) => void;
  backupToGist: () => Promise<void>;
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

          const state = get();
          const allIncomingRated = [...ratedMovies, ...ratedTv];
          const allIncomingWatchlist = [...wlMovies, ...wlTv];

          const mergeMetadata = (newItem: Media) => {
            // Find the item in either local list to preserve metadata
            const oldItem = state.watchlist.find(o => o.id === newItem.id && o.media_type === newItem.media_type) ||
                            state.watched.find(o => o.id === newItem.id && o.media_type === newItem.media_type);
            if (oldItem) {
              return {
                ...newItem,
                lastChecked: oldItem.lastChecked,
                next_episode_to_air: oldItem.next_episode_to_air,
                status: oldItem.status || newItem.status,
                date_added: oldItem.date_added || newItem.date_added
              };
            }
            return newItem;
          };

          // Process Rated list
          const finalWatched = allIncomingRated.map(mergeMetadata);

          // Process Watchlist with strict exclusivity check
          // First, we need to fetch fresh details for TV shows that are both watched and on watchlist
          const tvShowsNeedingFreshData: Media[] = [];
          for (const w of allIncomingWatchlist) {
            const isRatedOnTMDB = allIncomingRated.some(r => r.id === w.id && r.media_type === w.media_type);
            const isWatchedLocally = state.watched.some(o => o.id === w.id && o.media_type === w.media_type);
            
            if ((isRatedOnTMDB || isWatchedLocally) && w.media_type === 'tv') {
              tvShowsNeedingFreshData.push(w);
            }
          }

          // Fetch fresh details for these shows
          const freshShowDetails = new Map<number, any>();
          await Promise.all(
            tvShowsNeedingFreshData.map(async (show) => {
              try {
                const details = await getMediaDetails(show.id, 'tv', apiKey);
                freshShowDetails.set(show.id, details);
              } catch (err) {
                console.error(`Failed to fetch details for show ${show.id}:`, err);
              }
            })
          );

          const finalWatchlist = allIncomingWatchlist
            .filter(w => {
              const isRatedOnTMDB = allIncomingRated.some(r => r.id === w.id && r.media_type === w.media_type);
              const isWatchedLocally = state.watched.some(o => o.id === w.id && o.media_type === w.media_type);
              
              // If it's considered "Watched" (either on TMDB or in our current local state)
              if (isRatedOnTMDB || isWatchedLocally) {
                // For TV shows, use fresh data; for movies, this check doesn't apply
                if (w.media_type === 'tv') {
                  const freshDetails = freshShowDetails.get(w.id);
                  const syncAirDate = freshDetails?.next_episode_to_air?.air_date;
                  if (syncAirDate) {
                    const parts = syncAirDate.split('-');
                    if (parts.length === 3) {
                      const airDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const cutoff = new Date(today);
                      cutoff.setDate(today.getDate() + 7);
                      cutoff.setHours(23, 59, 59, 999);
                      if (airDate.getTime() >= today.getTime() && airDate.getTime() <= cutoff.getTime()) {
                        return true;
                      }
                    }
                  }
                  return false; // No upcoming episode or failed to fetch
                }
                return false; // Movies that are watched shouldn't be in watchlist
              }
              
              return true;
            })
            .map(mergeMetadata);

          set({ 
            watchlist: finalWatchlist,
            watched: finalWatched
          });
          lastSyncTime.current = Date.now();
        } catch (error: any) {
          console.error("TMDB Sync Error:", error);
          if (error.message?.includes('401')) {
            const { logoutTMDB } = get();
            logoutTMDB();
            toast.error('TMDB Session Expired. Please login again in settings.');
          }
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
        onboardingCompleted: false,
        editedStatusMap: {},
        gistBackupId: undefined,
        gistBackupToken: undefined,
        lastBackupTime: undefined,
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

        setOnboardingCompleted: (onboardingCompleted) => set({ onboardingCompleted }),

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

        setGistBackupConfig: (gistBackupId, gistBackupToken) => set({ gistBackupId, gistBackupToken }),

        backupToGist: async () => {
          const { gistBackupId, gistBackupToken, watchlist, watched } = get();
          if (!gistBackupId || !gistBackupToken) return;

          const formatItem = (m: Media) => {
            const title = m.title || m.name || 'Unknown';
            const year = (m.release_date || m.first_air_date || '').slice(0, 4);
            return `- ${title}${year ? ` (${year})` : ''} [${m.media_type}]`;
          };

          const now = new Date();
          const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
          const content = [
            `VOID Backup — ${dateStr}`,
            '',
            `WATCHLIST (${watchlist.length})`,
            ...watchlist.map(formatItem),
            '',
            `LIBRARY (${watched.length})`,
            ...watched.map(formatItem),
          ].join('\n');

          try {
            const res = await fetch(`https://api.github.com/gists/${gistBackupId}`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${gistBackupToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                files: { 'void-backup.txt': { content } },
              }),
            });
            if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);
            set({ lastBackupTime: Date.now() });
            toast.success('Backup saved to GitHub Gist');
          } catch (err: any) {
            console.error('Gist backup failed:', err);
            toast.error(`Backup failed: ${err.message}`);
          }
        },

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
          const { apiKey, tmdbSessionId, tmdbAccountId, isSyncing, isLoaded } = get();
          if (!isLoaded || !apiKey || isSyncing || !tmdbSessionId || !tmdbAccountId) return;
          
          const now = Date.now();
          const checkThreshold = 24 * 60 * 60 * 1000;
          
          const { watched } = get();
          const showsToProcess = watched.filter(m => 
            m.media_type === 'tv' && 
            m.status !== 'Ended' && 
            m.status !== 'Canceled' &&
            (now - (m.lastChecked || 0) > checkThreshold)
          );

          if (showsToProcess.length === 0) return;

          for (const show of showsToProcess) {
            // Re-verify membership in case of simultaneous sync
            if (!get().watched.some(m => m.id === show.id && m.media_type === 'tv')) continue;

            try {
              const details = await getMediaDetails(show.id, 'tv', apiKey);
              
              const airDateStr = details.next_episode_to_air?.air_date;
              const isAiringSoon = (() => {
                if (!airDateStr) return false;
                const parts = airDateStr.split('-');
                if (parts.length !== 3) return false;
                const airDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                if (isNaN(airDate.getTime())) return false;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const cutoff = new Date(today);
                cutoff.setDate(today.getDate() + 7);
                cutoff.setHours(23, 59, 59, 999);
                return airDate.getTime() >= today.getTime() && airDate.getTime() <= cutoff.getTime();
              })();

              if (isAiringSoon) {
                console.log(`[TV Migration] "${show.name || show.id}" has an episode airing within 7 days (${airDateStr}), migrating to watchlist`);

                // Migration to watchlist
                try {
                  await toggleWatchlistStatus(apiKey, tmdbSessionId, tmdbAccountId, show.id, 'tv', true);
                  try {
                    await deleteRating(apiKey, tmdbSessionId, show.id, 'tv');
                  } catch (deleteErr) {
                    // Revert watchlist addition on TMDB to avoid partial state
                    console.error(`[TV Migration] deleteRating failed for "${show.name || show.id}", reverting watchlist add`, deleteErr);
                    await toggleWatchlistStatus(apiKey, tmdbSessionId, tmdbAccountId, show.id, 'tv', false).catch(() => {});
                    throw deleteErr;
                  }
                } catch (tmdbErr) {
                  console.error(`[TV Migration] TMDB calls failed for "${show.name || show.id}"`, tmdbErr);
                  // Update lastChecked so we don't retry immediately, but don't migrate locally
                  set(state => ({
                    watched: state.watched.map(m => m.id === show.id && m.media_type === 'tv'
                      ? { ...m, lastChecked: now }
                      : m)
                  }));
                  continue;
                }

                set(state => ({
                  watched: state.watched.filter(m => !(m.id === show.id && m.media_type === 'tv')),
                  watchlist: [...state.watchlist, { ...show, ...details, lastChecked: now, date_added: new Date().toISOString() }]
                }));
              } else {
                // Metadata update only
                set(state => ({
                  watched: state.watched.map(m => m.id === show.id && m.media_type === 'tv' 
                    ? { ...m, status: details.status, next_episode_to_air: null, lastChecked: now } 
                    : m)
                }));
              }
            } catch (err) { console.error(err); }
          }
        },

        toggleWatchlist: async (media) => {
          const { apiKey, tmdbSessionId, tmdbAccountId, watchlist, watched } = get();
          const inWatchlist = watchlist.some((m) => m.id === media.id && m.media_type === media.media_type);
          
          if (inWatchlist) {
            set({ watchlist: watchlist.filter((m) => !(m.id === media.id && m.media_type === media.media_type)) });
          } else {
            set({ 
              watchlist: [...watchlist, { ...media, date_added: new Date().toISOString() }],
              watched: watched.filter((m) => !(m.id === media.id && m.media_type === media.media_type))
            });
          }

          if (apiKey && tmdbSessionId && tmdbAccountId) {
            try {
              await toggleWatchlistStatus(apiKey, tmdbSessionId, tmdbAccountId, media.id, media.media_type, !inWatchlist);
              // If we are adding to watchlist, also remove rating (history) on TMDB
              if (!inWatchlist) {
                await deleteRating(apiKey, tmdbSessionId, media.id, media.media_type);
              }
            } catch (err) { console.error(err); }
          }
        },

        toggleWatched: async (media, rating) => {
          const { apiKey, tmdbSessionId, tmdbAccountId, watched, watchlist } = get();
          const inWatched = watched.some((m) => m.id === media.id && m.media_type === media.media_type);
          
          if (inWatched && !rating) {
            set({ watched: watched.filter((m) => !(m.id === media.id && m.media_type === media.media_type)) });
            if (apiKey && tmdbSessionId && tmdbAccountId) {
              try { await deleteRating(apiKey, tmdbSessionId, media.id, media.media_type); } catch (err) { console.error(err); }
            }
          } else {
            set({
              watched: [...watched, { ...media, date_added: new Date().toISOString(), lastChecked: Date.now() }],
              watchlist: watchlist.filter((m) => !(m.id === media.id && m.media_type === media.media_type))
            });
            if (apiKey && tmdbSessionId && tmdbAccountId) {
              try { 
                await rateMedia(apiKey, tmdbSessionId, media.id, media.media_type, rating || 1);
                // Also remove from watchlist on TMDB when marking as watched
                await toggleWatchlistStatus(apiKey, tmdbSessionId, tmdbAccountId, media.id, media.media_type, false);
              } catch (err) { console.error(err); }
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

