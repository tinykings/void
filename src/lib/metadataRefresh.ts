import type { Media } from './types';
import { getMediaKey } from './media';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const METADATA_RETRY_DELAY_MS = 5 * 60 * 1000;
export const METADATA_POLL_INTERVAL_MS = 15 * 60 * 1000;
export const METADATA_BATCH_LIMIT = 30;
const POSTER_BATCH_PAUSE_MS = 250;

export type MetadataEntry = { item: Media; list: 'watchlist' | 'watched' };
export type MetadataSnapshot = { apiKey: string; watchlist: Media[]; watched: Media[] };

const lacksArtwork = ({ item }: MetadataEntry) => !item.poster_path && !item.backdrop_path;
const isOngoingShow = (item: Media) => item.media_type === 'tv' && item.status !== 'Ended' && item.status !== 'Canceled';
const validTimestamp = (value: number | undefined, now: number) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= now;

export const metadataMaxAge = ({ item, list }: MetadataEntry) =>
  list === 'watchlist' && isOngoingShow(item) ? DAY_MS : 7 * DAY_MS;

export const isMetadataStale = (entry: MetadataEntry, now = Date.now()) =>
  entry.item.media_type !== 'game' && (!validTimestamp(entry.item.metadataFetchedAt, now)
    || now - entry.item.metadataFetchedAt! >= metadataMaxAge(entry));

// This is separate from metadata age: History shows still need a daily return check.
export const needsReturningShowCheck = ({ item, list }: MetadataEntry, now = Date.now()) =>
  list === 'watched' && isOngoingShow(item)
    && (!validTimestamp(item.lastChecked, now) || now - item.lastChecked! >= DAY_MS);

/** Update API-owned metadata only; never overwrite library actions made during a request. */
export const mergeMediaMetadata = (current: Media, details: Partial<Media>, fetchedAt: number): Media => ({
  ...current,
  ...details,
  poster_path: details.poster_path || current.poster_path,
  backdrop_path: details.backdrop_path || current.backdrop_path,
  id: current.id,
  media_type: current.media_type,
  source: current.source,
  date_added: current.date_added,
  isFavorite: current.isFavorite,
  isPurchased: current.isPurchased,
  rating: current.rating,
  pinnedAt: current.pinnedAt,
  returnedFor: current.returnedFor,
  lastChecked: current.lastChecked,
  metadataFetchedAt: fetchedAt,
});

type RefreshOptions = {
  snapshot: () => MetadataSnapshot;
  canRefresh: () => boolean;
  fetchDetails: (item: Media, apiKey: string) => Promise<Media>;
  apply: (entry: MetadataEntry, details: Media, fetchedAt: number, checkReturn: boolean, apiKey: string) => Media | undefined;
  now?: () => number;
  pauseBetweenPosterBatches?: () => Promise<void>;
  onError?: (error: unknown) => void;
};

/** One sequential background queue shared by launch, sync, reconnect, and foreground events. */
export const createMetadataRefresher = (options: RefreshOptions) => {
  const now = options.now ?? Date.now;
  const retryAfter = new Map<string, number>();
  let blockedUntil = 0;
  let running: Promise<Media[]> | null = null;
  const pauseBetweenPosterBatches = options.pauseBetweenPosterBatches
    ?? (() => new Promise<void>((resolve) => setTimeout(resolve, POSTER_BATCH_PAUSE_MS)));
  const snapshotEntries = (snapshot: MetadataSnapshot): MetadataEntry[] => [
    ...snapshot.watchlist.map((item): MetadataEntry => ({ item, list: 'watchlist' })),
    ...snapshot.watched.map((item): MetadataEntry => ({ item, list: 'watched' })),
  ];

  const run = async () => {
    const returned: Media[] = [];
    const attempted = new Set<string>();
    const apiKey = options.snapshot().apiKey;
    let processed = 0;
    while (true) {
      const snapshot = options.snapshot();
      const time = now();
      if (!apiKey || snapshot.apiKey !== apiKey || !options.canRefresh() || time < blockedUntil) break;
      // Re-read state after each request so removals, moves, syncs, and newer details win.
      const entries = snapshotEntries(snapshot).filter((candidate) => {
        const key = getMediaKey(candidate.item);
        return candidate.item.media_type !== 'game' && !attempted.has(key)
          && time >= (retryAfter.get(key) ?? 0);
      });
      const missingArtwork = entries.find((candidate) => lacksArtwork(candidate) && isMetadataStale(candidate, time));
      if (processed === METADATA_BATCH_LIMIT) {
        // A large Gist import can outlast one pass. Yield and keep filling blank artwork;
        // ordinary periodic metadata refreshes remain bounded to one batch.
        if (!missingArtwork) break;
        await pauseBetweenPosterBatches();
        processed = 0;
        continue;
      }
      const entry = missingArtwork
        ?? entries.find((candidate) => isMetadataStale(candidate, time) || needsReturningShowCheck(candidate, time));
      if (!entry) break;
      const key = getMediaKey(entry.item);
      attempted.add(key);
      processed++;
      const checkReturn = needsReturningShowCheck(entry, time);
      try {
        // A recent details-screen fetch already contains the next episode. Reuse it.
        const canReuse = checkReturn && !isMetadataStale(entry, time)
          && validTimestamp(entry.item.metadataFetchedAt, time) && time - entry.item.metadataFetchedAt! < DAY_MS;
        const details = canReuse ? entry.item : await options.fetchDetails(entry.item, snapshot.apiKey);
        if (getMediaKey(details) !== key) throw new Error('Metadata response did not match the requested title');
        const fetchedAt = canReuse ? entry.item.metadataFetchedAt! : now();
        if (options.snapshot().apiKey !== snapshot.apiKey) break;
        const migrated = options.apply(entry, details, fetchedAt, checkReturn, snapshot.apiKey);
        if (migrated) returned.push(migrated);
        retryAfter.delete(key);
      } catch (error) {
        retryAfter.set(key, now() + METADATA_RETRY_DELAY_MS);
        options.onError?.(error);
        if (error instanceof Error && /\b429\b/.test(error.message)) {
          blockedUntil = now() + METADATA_RETRY_DELAY_MS;
          break;
        }
      }
    }
    return returned;
  };

  return () => {
    if (!running) running = run().finally(() => { running = null; });
    return running;
  };
};
