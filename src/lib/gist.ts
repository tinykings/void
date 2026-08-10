import type { Media } from './types';
import { getMediaSource } from './media';
import {
  MAX_LIBRARY_FILE_BYTES,
  validateLibraryPayload,
  type LibraryPayload,
  type LibraryPayloadItem,
} from './libraryPayload';

export type GistLibraryItem = LibraryPayloadItem;
export type GistLibraryData = LibraryPayload;

const GIST_FILENAME = 'void-data.json';
const LEGACY_GIST_FILENAME = 'void-library.json';

export const toGistItem = (item: Media): GistLibraryItem => ({
  id: item.id,
  title: item.title || item.name || 'Unknown',
  media_type: item.media_type,
  source: getMediaSource(item),
  date_added: item.date_added || new Date().toISOString(),
  release_date: item.release_date,
  image: item.poster_path || item.backdrop_path,
  poster_source: item.poster_source,
  rating: item.rating,
  isPurchased: item.media_type === 'game' ? item.isPurchased : undefined,
});

export const fromGistItem = (item: GistLibraryItem, isFavorite = false): Media => ({
  id: item.id,
  title: item.title,
  name: item.title,
  poster_path: item.image || null,
  backdrop_path: item.image || null,
  overview: '',
  vote_average: 0,
  popularity: 0,
  media_type: item.media_type,
  source: item.source || (item.media_type === 'game' ? 'igdb' : 'tmdb'),
  date_added: item.date_added,
  release_date: item.release_date,
  poster_source: item.poster_source,
  rating: item.rating,
  isFavorite,
  isPurchased: item.isPurchased,
});

export const buildGistPayload = (
  watchlist: Media[],
  watched: Media[],
  playedEpisodes: Record<string, boolean> = {},
): GistLibraryData => ({
  version: 4,
  watchlist: watchlist.map(toGistItem),
  watched: watched.map(toGistItem),
  favorites: [...watchlist, ...watched].filter((item) => item.isFavorite).map(toGistItem),
  playedEpisodes,
});

export const isEmptyGistPayload = (payload: GistLibraryData) =>
  payload.watchlist.length === 0
  && payload.watched.length === 0
  && payload.favorites.length === 0
  && Object.keys(payload.playedEpisodes ?? {}).length === 0;

type GistFile = {
  content?: unknown;
};

type GistApiResponse = {
  files?: Record<string, GistFile | null>;
};

export type GistContentResult =
  | { status: 'loaded'; data: GistLibraryData }
  | { status: 'empty' }
  | { status: 'missing' }
  | { status: 'invalid'; reason: string };

export const getGistContent = async (gistId: string, token?: string): Promise<GistContentResult> => {
  const response = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to read gist: ${response.status}`);
  }

  let data: GistApiResponse;
  try {
    data = await response.json() as GistApiResponse;
  } catch {
    throw new Error('Failed to read gist: GitHub returned invalid JSON');
  }

  const filename = data.files?.[GIST_FILENAME] ? GIST_FILENAME : LEGACY_GIST_FILENAME;
  const file = data.files?.[filename];
  if (!file) return { status: 'missing' };
  if (typeof file.content !== 'string') {
    return { status: 'invalid', reason: `${filename} has no readable content` };
  }
  if (!file.content.trim()) return { status: 'empty' };
  if (new Blob([file.content]).size > MAX_LIBRARY_FILE_BYTES) {
    return { status: 'invalid', reason: `${filename} exceeds the 2 MB size limit` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(file.content);
  } catch {
    return { status: 'invalid', reason: `${filename} contains invalid JSON` };
  }

  const validation = validateLibraryPayload(parsed);
  if (!validation.success) {
    return { status: 'invalid', reason: `${filename}: ${validation.error}` };
  }

  return { status: 'loaded', data: validation.data };
};

export const updateGist = async (gistId: string, token: string, content: GistLibraryData): Promise<void> => {
  const response = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      files: {
        [GIST_FILENAME]: {
          content: JSON.stringify(content, null, 2),
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update gist: ${response.status}`);
  }
};
