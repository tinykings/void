import { Media } from './types';

export type GistLibraryItem = {
  id: number;
  title: string;
  media_type: 'movie' | 'tv';
  date_added: string;
};

export interface GistLibraryData {
  version: 1;
  watchlist: GistLibraryItem[];
  watched: GistLibraryItem[];
  favorites: GistLibraryItem[];
}

const GIST_FILENAME = 'void-library.json';

export const toGistItem = (item: Media): GistLibraryItem => ({
  id: item.id,
  title: item.title || item.name || 'Unknown',
  media_type: item.media_type,
  date_added: item.date_added || new Date().toISOString(),
});

export const fromGistItem = (item: GistLibraryItem, isFavorite = false): Media => ({
  id: item.id,
  title: item.title,
  name: item.title,
  poster_path: null,
  backdrop_path: null,
  overview: '',
  vote_average: 0,
  popularity: 0,
  media_type: item.media_type,
  date_added: item.date_added,
  isFavorite,
});

export const buildGistPayload = (watchlist: Media[], watched: Media[]): GistLibraryData => ({
  version: 1,
  watchlist: watchlist.map(toGistItem),
  watched: watched.map(toGistItem),
  favorites: watched.filter((item) => item.isFavorite).map(toGistItem),
});

export const isEmptyGistPayload = (payload: GistLibraryData | null | undefined) => {
  if (!payload) return true;
  return payload.watchlist.length === 0 && payload.watched.length === 0 && payload.favorites.length === 0;
};

export const getGistContent = async (gistId: string): Promise<GistLibraryData | null> => {
  const response = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: { Accept: 'application/vnd.github+json' },
  });

  if (!response.ok) return null;

  const data = await response.json();
  const file = data.files?.[GIST_FILENAME] || Object.values(data.files || {})[0];
  if (!file?.content) return null;

  try {
    return JSON.parse(file.content) as GistLibraryData;
  } catch {
    return null;
  }
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
