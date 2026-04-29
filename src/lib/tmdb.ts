import { Media, WatchProvidersResponse, SeasonDetails, TmdbResult, ReleaseDatesResponse, ContentRatingsResponse, ReleaseDatesResult, ContentRating, ReleaseDate, VideosResponse, CreditsResponse, PersonCreditsResponse, PersonDetails } from './types';

const BASE_URL = 'https://api.themoviedb.org/3';

const buildHeaders = (accessToken: string) => ({
  Accept: 'application/json',
  Authorization: `Bearer ${accessToken}`,
});

export const fetchFromTMDB = async (endpoint: string, apiKey: string, params: Record<string, string> = {}, signal?: AbortSignal) => {
  const queryParams = new URLSearchParams({
    ...params,
  });

  const response = await fetch(`${BASE_URL}${endpoint}?${queryParams}`, {
    signal,
    headers: buildHeaders(apiKey),
  });
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
  } catch {
    return null;
  }
};

export const getMediaDetails = async (id: number, type: 'movie' | 'tv', apiKey: string): Promise<Media> => {
  const data: Media = await fetchFromTMDB(`/${type}/${id}`, apiKey);
  return { ...data, media_type: type };
};

export const getUSReleaseDate = async (id: number, type: 'movie' | 'tv', apiKey: string): Promise<string | null> => {
  try {
    if (type === 'movie') {
      const data: ReleaseDatesResponse = await fetchFromTMDB(`/movie/${id}/release_dates`, apiKey);
      const usRelease = data.results?.find((r: ReleaseDatesResult) => r.iso_3166_1 === 'US');
      const releaseDate = usRelease?.release_dates?.find((d: ReleaseDate) => d.type === 3 || d.type === 2);
      return releaseDate?.release_date?.split('T')[0] || null;
    } else {
      const data: Media = await fetchFromTMDB(`/tv/${id}`, apiKey);
      return data.first_air_date || null;
    }
  } catch {
    return null;
  }
};

export const getWatchProviders = async (id: number, type: 'movie' | 'tv', apiKey: string): Promise<WatchProvidersResponse> => {
  return fetchFromTMDB(`/${type}/${id}/watch/providers`, apiKey);
};

export const getMediaVideos = async (id: number, type: 'movie' | 'tv', apiKey: string): Promise<VideosResponse> => {
  return fetchFromTMDB(`/${type}/${id}/videos`, apiKey);
};

export const getMediaCredits = async (id: number, type: 'movie' | 'tv', apiKey: string): Promise<CreditsResponse> => {
  return fetchFromTMDB(`/${type}/${id}/credits`, apiKey);
};

export const getPersonCredits = async (personId: number, apiKey: string): Promise<PersonCreditsResponse> => {
  return fetchFromTMDB(`/person/${personId}/combined_credits`, apiKey);
};

export const getPersonDetails = async (personId: number, apiKey: string): Promise<PersonDetails> => {
  return fetchFromTMDB(`/person/${personId}`, apiKey);
};

export const getImageUrl = (path: string | null, size: 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w342') => {
  if (!path) return ''; 
  return `https://image.tmdb.org/t/p/${size}${path}`;
};

export const getSeasonDetails = async (tvId: number, seasonNumber: number, apiKey: string): Promise<SeasonDetails> => {
  return fetchFromTMDB(`/tv/${tvId}/season/${seasonNumber}`, apiKey);
};
