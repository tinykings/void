import { Media, WatchProvidersResponse } from './types';

const BASE_URL = 'https://api.themoviedb.org/3';

export const fetchFromTMDB = async (endpoint: string, apiKey: string, params: Record<string, string> = {}) => {
  const queryParams = new URLSearchParams({
    api_key: apiKey,
    ...params,
  });

  const response = await fetch(`${BASE_URL}${endpoint}?${queryParams}`);
  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.statusText}`);
  }
  return response.json();
};

export const searchMedia = async (query: string, apiKey: string): Promise<Media[]> => {
  const data = await fetchFromTMDB('/search/multi', apiKey, { query });
  return data.results.filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv');
};

export const getTrending = async (apiKey: string, type: 'all' | 'movie' | 'tv' = 'all'): Promise<Media[]> => {
  const data = await fetchFromTMDB(`/trending/${type}/week`, apiKey);
  return data.results.filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv' || type !== 'all');
};

export const getContentRating = async (id: number, type: 'movie' | 'tv', apiKey: string): Promise<string | null> => {
  try {
    if (type === 'movie') {
      const data = await fetchFromTMDB(`/movie/${id}/release_dates`, apiKey);
      const usRelease = data.results?.find((r: any) => r.iso_3166_1 === 'US');
      // Sort by type to prioritize theatrical releases (type 3) if possible, or just find first with certification
      const cert = usRelease?.release_dates?.find((d: any) => d.certification)?.certification;
      return cert || null;
    } else {
      const data = await fetchFromTMDB(`/tv/${id}/content_ratings`, apiKey);
      const usRating = data.results?.find((r: any) => r.iso_3166_1 === 'US');
      return usRating?.rating || null;
    }
  } catch (e) {
    return null;
  }
};

export const getRecommendations = async (id: number, type: 'movie' | 'tv', apiKey: string): Promise<Media[]> => {
  const data = await fetchFromTMDB(`/${type}/${id}/recommendations`, apiKey);
  return data.results.filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv' || (type === 'movie' ? !item.media_type : false)); // TMDB sometimes omits media_type in recommendations, infer from source
};

export const getMediaDetails = async (id: number, type: 'movie' | 'tv', apiKey: string): Promise<Media> => {
  const data = await fetchFromTMDB(`/${type}/${id}`, apiKey);
  return { ...data, media_type: type };
};

export const getWatchProviders = async (id: number, type: 'movie' | 'tv', apiKey: string): Promise<WatchProvidersResponse> => {
  return fetchFromTMDB(`/${type}/${id}/watch/providers`, apiKey);
};

export const getImageUrl = (path: string | null, size: 'w500' | 'original' = 'w500') => {
  if (!path) return ''; 
  return `https://image.tmdb.org/t/p/${size}${path}`;
};