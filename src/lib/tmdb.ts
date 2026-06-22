import { Media, WatchProvider, WatchProvidersResponse, SeasonDetails, TmdbResult, ReleaseDatesResponse, ContentRatingsResponse, ExternalIdsResponse, ReleaseDatesResult, ContentRating, ReleaseDate, CreditsResponse, PersonCreditsResponse, PersonDetails, ImagesResponse, VideosResponse } from './types';

const BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_MAX_RETRIES = 2;
const TMDB_RETRY_DELAY_MS = 1500;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const buildHeaders = (accessToken: string) => ({
  Accept: 'application/json',
  Authorization: `Bearer ${accessToken}`,
});

export const fetchFromTMDB = async (endpoint: string, apiKey: string, params: Record<string, string> = {}, signal?: AbortSignal) => {
  const queryParams = new URLSearchParams({
    ...params,
  });

  for (let attempt = 0; attempt <= TMDB_MAX_RETRIES; attempt += 1) {
    const response = await fetch(`${BASE_URL}${endpoint}?${queryParams}`, {
      signal,
      headers: buildHeaders(apiKey),
    });

    if (response.ok) {
      return response.json();
    }

    if (response.status === 429 && attempt < TMDB_MAX_RETRIES) {
      const retryAfterSeconds = Number(response.headers.get('Retry-After'));
      await delay(Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : TMDB_RETRY_DELAY_MS * (attempt + 1));
      continue;
    }

    throw new Error(`TMDB API error: ${response.status} ${response.statusText}`.trim());
  }

  throw new Error('TMDB API error');
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
  const data: Media & { videos?: VideosResponse } = await fetchFromTMDB(`/${type}/${id}`, apiKey, { append_to_response: 'videos' });
  return { ...data, media_type: type, videos: data.videos?.results || [] };
};

export const getExternalIds = async (id: number, type: 'movie' | 'tv', apiKey: string): Promise<ExternalIdsResponse> => {
  return fetchFromTMDB(`/${type}/${id}/external_ids`, apiKey);
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

const cleanProviderName = (name: string) => name.replace(/\s+/g, ' ').trim();
const normalizeProviderName = (name: string) => cleanProviderName(name).toLowerCase();

const getCanonicalProviderName = (name: string) => {
  const cleaned = cleanProviderName(name);

  if (/ standard with ads$/i.test(cleaned)) {
    return cleanProviderName(cleaned.replace(/ standard with ads$/i, ''));
  }

  if (/ with ads$/i.test(cleaned)) {
    return cleanProviderName(cleaned.replace(/ with ads$/i, ''));
  }

  if (/ essential$/i.test(cleaned)) {
    return cleanProviderName(cleaned.replace(/ essential$/i, ''));
  }

  if (/ premium plus$/i.test(cleaned)) {
    return cleanProviderName(cleaned.replace(/ plus$/i, ''));
  }

  if (/ plus premium$/i.test(cleaned)) {
    return cleanProviderName(cleaned.replace(/ premium$/i, ''));
  }

  return cleaned;
};

export const getUSStreamingProviders = (data: WatchProvidersResponse): WatchProvider[] => {
  const usProviders = data.results?.US;
  const providers = [...(usProviders?.free || []), ...(usProviders?.flatrate || [])]
    .filter((provider) => !provider.provider_name.toLowerCase().includes('channel'))
    .filter((provider, index, array) => array.findIndex((item) => item.provider_id === provider.provider_id) === index);

  const canonicalProviders = providers.map((provider) => ({
    ...provider,
    provider_name: getCanonicalProviderName(provider.provider_name),
  }));

  const uniqueProviders = canonicalProviders.filter((provider, index, array) => {
    const providerName = normalizeProviderName(provider.provider_name);
    return array.findIndex((item) => normalizeProviderName(item.provider_name) === providerName) === index;
  });

  return uniqueProviders.filter((provider) => {
    const providerName = normalizeProviderName(provider.provider_name);
    return !uniqueProviders.some((candidate) => {
      if (candidate.provider_id === provider.provider_id) return false;
      const candidateName = normalizeProviderName(candidate.provider_name);
      return providerName.startsWith(`${candidateName} `);
    });
  });
};

export const getMediaImages = async (id: number, type: 'movie' | 'tv', apiKey: string): Promise<ImagesResponse> => {
  return fetchFromTMDB(`/${type}/${id}/images`, apiKey);
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
