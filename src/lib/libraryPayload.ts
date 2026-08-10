import type { Media } from './types';

export const MAX_LIBRARY_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_LIBRARY_ITEMS_PER_LIST = 10_000;

const MEDIA_TYPES = ['movie', 'tv', 'game'] as const;
const MEDIA_SOURCES = ['tmdb', 'igdb', 'rawg', 'steam'] as const;
const ITEM_KEYS = new Set([
  'id',
  'title',
  'media_type',
  'source',
  'date_added',
  'release_date',
  'image',
  'poster_source',
  'rating',
  'isPurchased',
]);
const PAYLOAD_KEYS = new Set(['version', 'watchlist', 'watched', 'favorites', 'playedEpisodes']);

export type LibraryPayloadItem = {
  id: number;
  title: string;
  media_type: (typeof MEDIA_TYPES)[number];
  source?: (typeof MEDIA_SOURCES)[number];
  date_added: string;
  release_date?: string;
  image?: string | null;
  poster_source?: Media['poster_source'];
  rating?: number;
  isPurchased?: boolean;
};

export interface LibraryPayload {
  version: 1 | 2 | 3 | 4;
  watchlist: LibraryPayloadItem[];
  watched: LibraryPayloadItem[];
  favorites: LibraryPayloadItem[];
  playedEpisodes?: Record<string, boolean>;
}

export type LibraryPayloadValidation =
  | { success: true; data: LibraryPayload }
  | { success: false; error: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const hasOnlyKeys = (value: Record<string, unknown>, allowed: Set<string>) =>
  Object.keys(value).every((key) => allowed.has(key));

const isValidDate = (value: unknown) => {
  if (typeof value !== 'string' || value.length > 64 || value.trim() !== value) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})(.*)$/.exec(value);
  if (!match || (match[4] && !match[4].startsWith('T')) || !Number.isFinite(Date.parse(value))) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  return calendarDate.getUTCFullYear() === year
    && calendarDate.getUTCMonth() === month - 1
    && calendarDate.getUTCDate() === day;
};

const isValidSourceForType = (source: unknown, mediaType: unknown) => {
  if (source === undefined) return true;
  if (!MEDIA_SOURCES.includes(source as (typeof MEDIA_SOURCES)[number])) return false;
  return mediaType === 'game' ? source !== 'tmdb' : source === 'tmdb';
};

const validateItem = (value: unknown, path: string): string | null => {
  if (!isRecord(value)) return `${path} must be an object`;
  if (!hasOnlyKeys(value, ITEM_KEYS)) return `${path} contains unsupported fields`;
  if (!Number.isSafeInteger(value.id) || (value.id as number) <= 0) return `${path}.id must be a positive safe integer`;
  if (typeof value.title !== 'string' || !value.title.trim() || value.title.length > 500) {
    return `${path}.title must be a non-empty string of at most 500 characters`;
  }
  if (!MEDIA_TYPES.includes(value.media_type as (typeof MEDIA_TYPES)[number])) {
    return `${path}.media_type must be movie, tv, or game`;
  }
  if (!isValidSourceForType(value.source, value.media_type)) {
    return `${path}.source is invalid for ${String(value.media_type)}`;
  }
  if (!isValidDate(value.date_added)) return `${path}.date_added must be a valid date`;
  if (value.release_date !== undefined && !isValidDate(value.release_date)) {
    return `${path}.release_date must be a valid date`;
  }
  if (value.image !== undefined && value.image !== null
    && (typeof value.image !== 'string' || value.image.length > 2_048)) {
    return `${path}.image must be null or a string of at most 2048 characters`;
  }
  if (value.poster_source !== undefined
    && !MEDIA_SOURCES.includes(value.poster_source as (typeof MEDIA_SOURCES)[number])) {
    return `${path}.poster_source must be tmdb, igdb, rawg, or steam`;
  }
  if (value.rating !== undefined
    && (!Number.isInteger(value.rating) || (value.rating as number) < 1 || (value.rating as number) > 5)) {
    return `${path}.rating must be an integer from 1 to 5`;
  }
  if (value.isPurchased !== undefined
    && (typeof value.isPurchased !== 'boolean' || value.media_type !== 'game')) {
    return `${path}.isPurchased must be a boolean for games`;
  }
  return null;
};

const validateList = (value: unknown, path: string): string | null => {
  if (!Array.isArray(value)) return `${path} must be an array`;
  if (value.length > MAX_LIBRARY_ITEMS_PER_LIST) {
    return `${path} must contain at most ${MAX_LIBRARY_ITEMS_PER_LIST} items`;
  }
  for (let index = 0; index < value.length; index += 1) {
    const error = validateItem(value[index], `${path}[${index}]`);
    if (error) return error;
  }
  return null;
};

export const isPlayedEpisodesData = (value: unknown): value is Record<string, boolean> => {
  if (!isRecord(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= MAX_LIBRARY_ITEMS_PER_LIST
    && entries.every(([key, played]) => /^\d+-\d+-\d+$/.test(key) && key.length <= 64 && played === true);
};

export const validateLibraryPayload = (value: unknown): LibraryPayloadValidation => {
  if (!isRecord(value)) return { success: false, error: 'library payload must be an object' };
  if (!hasOnlyKeys(value, PAYLOAD_KEYS)) {
    return { success: false, error: 'library payload contains unsupported fields' };
  }
  if (value.version !== 1 && value.version !== 2 && value.version !== 3 && value.version !== 4) {
    return { success: false, error: 'version must be 1, 2, 3, or 4' };
  }

  for (const list of ['watchlist', 'watched', 'favorites'] as const) {
    const error = validateList(value[list], list);
    if (error) return { success: false, error };
  }

  if ((value.version === 3 || value.version === 4) && !isPlayedEpisodesData(value.playedEpisodes)) {
    return { success: false, error: 'playedEpisodes must contain episode keys mapped to true' };
  }
  if (value.version !== 3 && value.version !== 4 && value.playedEpisodes !== undefined && !isPlayedEpisodesData(value.playedEpisodes)) {
    return { success: false, error: 'playedEpisodes must contain episode keys mapped to true' };
  }

  return { success: true, data: value as unknown as LibraryPayload };
};
