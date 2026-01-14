export interface SeasonSummary {
  id: number;
  name: string;
  season_number: number;
  episode_count: number;
  air_date: string | null;
  poster_path: string | null;
}

export interface Episode {
  id: number;
  name: string;
  overview: string;
  vote_average: number;
  air_date: string;
  episode_number: number;
  season_number: number;
  still_path: string | null;
}

export interface SeasonDetails {
  _id: string;
  air_date: string;
  name: string;
  overview: string;
  id: number;
  poster_path: string | null;
  season_number: number;
  episodes: Episode[];
}

export interface Media {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  popularity: number;
  media_type: 'movie' | 'tv';
  seasons?: SeasonSummary[];
  next_episode_to_air?: {
    air_date: string;
    episode_number: number;
    season_number: number;
    name: string;
    overview: string;
    still_path: string | null;
  } | null;
}

export interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

export interface WatchProvidersResponse {
  results: {
    [countryCode: string]: {
      link: string;
      flatrate?: WatchProvider[];
      rent?: WatchProvider[];
      buy?: WatchProvider[];
    };
  };
}

export type ListType = 'watchlist' | 'watched';

export interface UserState {
  apiKey: string;
  watchlist: Media[];
  watched: Media[];
  githubToken?: string;
  gistId?: string;
  vidAngelEnabled?: boolean;
}
