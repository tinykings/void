import { Media } from './types';

const RAWG_BASE_URL = 'https://api.rawg.io/api';
const RAWG_API_KEY = process.env.NEXT_PUBLIC_RAWG_API_KEY || '';
const RAWG_PAGE_SIZE = '20';

type RawgNamedItem = {
  id: number;
  name: string;
  slug?: string;
};

type RawgStoreItem = {
  store?: {
    name?: string;
    domain?: string;
  };
};

type RawgGame = {
  id: number;
  slug?: string;
  name: string;
  background_image: string | null;
  background_image_additional?: string | null;
  short_screenshots?: { image: string }[];
  description_raw?: string;
  released?: string | null;
  tba?: boolean;
  rating?: number;
  ratings_count?: number;
  metacritic?: number | null;
  playtime?: number;
  website?: string | null;
  platforms?: { platform: RawgNamedItem }[] | null;
  genres?: RawgNamedItem[] | null;
  stores?: RawgStoreItem[] | null;
};

type RawgSearchResponse = {
  results?: RawgGame[];
};

type RawgScreenshotsResponse = {
  results?: { image: string }[];
};

const fetchFromRawg = async <T>(endpoint: string, params: Record<string, string> = {}, signal?: AbortSignal): Promise<T> => {
  if (!RAWG_API_KEY) {
    throw new Error('RAWG API key is not configured');
  }

  const query = new URLSearchParams({
    key: RAWG_API_KEY,
    ...params,
  });

  const response = await fetch(`${RAWG_BASE_URL}${endpoint}?${query}`, { signal });
  if (!response.ok) {
    throw new Error(`RAWG API error: ${response.status} ${response.statusText}`.trim());
  }

  return response.json();
};

const getRawgUrl = (game: RawgGame) => `https://rawg.io/games/${game.slug || game.id}`;

const getStoreUrl = (domain?: string) => {
  if (!domain) return '';
  return domain.startsWith('http') ? domain : `https://${domain}`;
};

const getStoreName = (store?: RawgStoreItem['store']) => store?.name || '';

const normalizeRawgStores = (stores?: RawgStoreItem[] | null) => (stores || [])
  .map((item) => ({
    name: getStoreName(item.store),
    url: getStoreUrl(item.store?.domain),
  }))
  .filter((store) => store.name && store.url);

export const normalizeRawgGame = (game: RawgGame, screenshots: string[] = []): Media => {
  const screenshotImages = [
    ...screenshots,
    ...(game.short_screenshots || []).map((item) => item.image),
  ].filter(Boolean);
  const uniqueScreenshots = [...new Set(screenshotImages)];
  const primaryImage = game.background_image || uniqueScreenshots[0] || null;

  return {
    id: game.id,
    title: game.name,
    name: game.name,
    poster_path: primaryImage,
    backdrop_path: game.background_image_additional || primaryImage,
    overview: game.description_raw || '',
    release_date: game.released || undefined,
    vote_average: game.metacritic ? game.metacritic / 10 : game.rating || 0,
    vote_count: game.ratings_count,
    popularity: game.ratings_count || 0,
    media_type: 'game',
    source: 'rawg',
    poster_source: 'rawg',
    status: game.tba ? 'TBA' : undefined,
    platforms: (game.platforms || []).map((item) => item.platform?.name).filter(Boolean),
    genres: (game.genres || []).map((genre) => genre.name).filter(Boolean),
    metacritic: game.metacritic ?? null,
    playtime: game.playtime,
    website: game.website || null,
    stores: normalizeRawgStores(game.stores),
    screenshots: uniqueScreenshots,
    source_url: getRawgUrl(game),
  };
};

export const searchRawgGames = async (query: string, signal?: AbortSignal): Promise<Media[]> => {
  const data = await fetchFromRawg<RawgSearchResponse>('/games', {
    search: query,
    page_size: RAWG_PAGE_SIZE,
    search_precise: 'false',
  }, signal);

  return (data.results || []).map((game) => normalizeRawgGame(game));
};

export const getRawgGameDetails = async (id: number, signal?: AbortSignal): Promise<Media> => {
  const [game, screenshotData] = await Promise.all([
    fetchFromRawg<RawgGame>(`/games/${id}`, {}, signal),
    fetchFromRawg<RawgScreenshotsResponse>(`/games/${id}/screenshots`, { page_size: '5' }, signal).catch(() => ({ results: [] })),
  ]);

  const screenshots = (screenshotData.results || []).map((item) => item.image).filter(Boolean);
  return normalizeRawgGame(game, screenshots);
};

export const hasRawgApiKey = () => !!RAWG_API_KEY;
