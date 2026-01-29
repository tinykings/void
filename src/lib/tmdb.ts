import { Media, WatchProvidersResponse, SeasonDetails, TmdbResult, ReleaseDatesResponse, ContentRatingsResponse, ReleaseDatesResult, ContentRating, ReleaseDate, VideosResponse } from './types';

const BASE_URL = 'https://api.themoviedb.org/3';

export const fetchFromTMDB = async (endpoint: string, apiKey: string, params: Record<string, string> = {}, signal?: AbortSignal) => {
  const queryParams = new URLSearchParams({
    api_key: apiKey,
    ...params,
  });

  const response = await fetch(`${BASE_URL}${endpoint}?${queryParams}`, { signal });
  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.statusText}`);
  }
  return response.json();
};

export const searchMedia = async (query: string, apiKey: string, signal?: AbortSignal): Promise<Media[]> => {
  const data = await fetchFromTMDB('/search/multi', apiKey, { query }, signal);
  return data.results.filter((item: TmdbResult) => item.media_type === 'movie' || item.media_type === 'tv');
};

export const getTrending = async (apiKey: string, type: 'all' | 'movie' | 'tv' = 'all'): Promise<Media[]> => {
  const data = await fetchFromTMDB(`/trending/${type}/week`, apiKey);
  return data.results.filter((item: TmdbResult) => item.media_type === 'movie' || item.media_type === 'tv' || type !== 'all');
};

export const getContentRating = async (id: number, type: 'movie' | 'tv', apiKey: string): Promise<string | null> => {
  try {
    if (type === 'movie') {
      const data: ReleaseDatesResponse = await fetchFromTMDB(`/movie/${id}/release_dates`, apiKey);
      const usRelease = data.results?.find((r: ReleaseDatesResult) => r.iso_3166_1 === 'US');
      const cert = usRelease?.release_dates?.find((d: ReleaseDate) => d.certification)?.certification;
      return cert || null;
    } else {
      const data: ContentRatingsResponse = await fetchFromTMDB(`/tv/${id}/content_ratings`, apiKey);
      const usRating = data.results?.find((r: ContentRating) => r.iso_3166_1 === 'US');
      return usRating?.rating || null;
    }
  } catch (error) {
    console.error("Error fetching content rating:", error);
    return null;
  }
};

export const getMediaDetails = async (id: number, type: 'movie' | 'tv', apiKey: string): Promise<Media> => {
  const data: Media = await fetchFromTMDB(`/${type}/${id}`, apiKey);
  return { ...data, media_type: type };
};

export const getWatchProviders = async (id: number, type: 'movie' | 'tv', apiKey: string): Promise<WatchProvidersResponse> => {
  return fetchFromTMDB(`/${type}/${id}/watch/providers`, apiKey);
};

export const getMediaVideos = async (id: number, type: 'movie' | 'tv', apiKey: string): Promise<VideosResponse> => {
  return fetchFromTMDB(`/${type}/${id}/videos`, apiKey);
};

export const getImageUrl = (path: string | null, size: 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w342') => {
  if (!path) return ''; 
  return `https://image.tmdb.org/t/p/${size}${path}`;
};

export const getSeasonDetails = async (tvId: number, seasonNumber: number, apiKey: string): Promise<SeasonDetails> => {
  return fetchFromTMDB(`/tv/${tvId}/season/${seasonNumber}`, apiKey);
};

// --- Auth & Account ---

export const createRequestToken = async (apiKey: string) => {
  const data = await fetchFromTMDB('/authentication/token/new', apiKey);
  return data.request_token;
};

export const createSession = async (apiKey: string, requestToken: string) => {
  const response = await fetch(`${BASE_URL}/authentication/session/new?api_key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_token: requestToken }),
  });
  const data = await response.json();
  return data.session_id;
};

export const getAccountDetails = async (apiKey: string, sessionId: string) => {
  return fetchFromTMDB('/account', apiKey, { session_id: sessionId });
};

export const getAccountLists = async (apiKey: string, sessionId: string, accountId: number, type: 'movies' | 'tv', list: 'watchlist' | 'rated', page: number = 1) => {
  const endpoint = `/account/${accountId}/${list}/${type}`;
  const data = await fetchFromTMDB(endpoint, apiKey, { session_id: sessionId, sort_by: 'created_at.desc', page: page.toString() });
  return {
    results: data.results.map((item: any) => ({
      ...item,
      media_type: type === 'movies' ? 'movie' : 'tv'
    })),
    totalPages: data.total_pages
  };
};

export const toggleWatchlistStatus = async (apiKey: string, sessionId: string, accountId: number, mediaId: number, mediaType: 'movie' | 'tv', watchlist: boolean) => {
  const response = await fetch(`${BASE_URL}/account/${accountId}/watchlist?api_key=${apiKey}&session_id=${sessionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: mediaType,
      media_id: mediaId,
      watchlist: watchlist
    }),
  });
  return response.json();
};

export const rateMedia = async (apiKey: string, sessionId: string, mediaId: number, mediaType: 'movie' | 'tv', rating: number) => {
  // TMDB rating is 0.5 to 10. We receive 1-5, so we multiply by 2.
  const response = await fetch(`${BASE_URL}/${mediaType}/${mediaId}/rating?api_key=${apiKey}&session_id=${sessionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: rating * 2 }),
  });
  return response.json();
};

export const deleteRating = async (apiKey: string, sessionId: string, mediaId: number, mediaType: 'movie' | 'tv') => {
  const response = await fetch(`${BASE_URL}/${mediaType}/${mediaId}/rating?api_key=${apiKey}&session_id=${sessionId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  return response.json();
};