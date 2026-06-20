import { Media } from './types';

const DEFAULT_LOCAL_GAME_API_BASE_URL = 'http://localhost:8787';
const GAME_API_BASE_URL = (
  process.env.NEXT_PUBLIC_GAME_API_BASE_URL ||
  (process.env.NODE_ENV === 'development' ? DEFAULT_LOCAL_GAME_API_BASE_URL : '')
).replace(/\/$/, '');

const fetchFromGameApi = async <T>(path: string, signal?: AbortSignal): Promise<T> => {
  if (!GAME_API_BASE_URL) {
    throw new Error('Game API URL is not configured');
  }

  const response = await fetch(`${GAME_API_BASE_URL}${path}`, { signal });
  if (!response.ok) {
    let message = `Game API error: ${response.status}`;

    try {
      const data = await response.json() as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // Keep the status-based message when the response is not JSON.
    }

    throw new Error(message);
  }

  return response.json();
};

export const searchIgdbGames = async (query: string, signal?: AbortSignal): Promise<Media[]> => {
  const params = new URLSearchParams({ q: query });
  return fetchFromGameApi<Media[]>(`/api/games/search?${params}`, signal);
};

export const getIgdbGameDetails = async (id: number, signal?: AbortSignal): Promise<Media> => {
  return fetchFromGameApi<Media>(`/api/games/${id}`, signal);
};

export const hasGameApi = () => !!GAME_API_BASE_URL;
