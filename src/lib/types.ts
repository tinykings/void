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

export type MediaType = 'movie' | 'tv' | 'game';

export type MediaSource = 'tmdb' | 'rawg' | 'steam';

export interface Media {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  tagline?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  vote_count?: number;
  rating?: number;
  popularity: number;
  media_type: MediaType;
  source?: MediaSource;
  status?: string;
  date_added?: string;
  lastChecked?: number;
  isFavorite?: boolean;
  platforms?: string[];
  genres?: string[];
  metacritic?: number | null;
  playtime?: number;
  website?: string | null;
  stores?: { name: string; url: string }[];
  screenshots?: string[];
  source_url?: string;
  poster_source?: 'tmdb' | 'rawg' | 'steam';
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

export interface TmdbResult {
  id: number;
  media_type: 'movie' | 'tv';
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  vote_average: number;
  vote_count?: number;
  rating?: number;
  popularity: number;
}

export interface ReleaseDate {
  certification: string;
  iso_639_1: string;
  note: string;
  release_date: string;
  type: number;
}

export interface ReleaseDatesResult {
  iso_3166_1: string;
  release_dates: ReleaseDate[];
}

export interface ReleaseDatesResponse {
  id: number;
  results: ReleaseDatesResult[];
}

export interface ContentRating {
  iso_3166_1: string;
  rating: string;
}

export interface ContentRatingsResponse {
  id: number;
  results: ContentRating[];
}

export interface ExternalIdsResponse {
  id: number;
  imdb_id: string | null;
}

export interface Video {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
  published_at: string;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface PersonDetails {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
}

export interface CreditsResponse {
  id: number;
  cast: CastMember[];
}

export interface PersonCreditsResponse {
  id: number;
  cast: (TmdbResult & { character: string })[];
}

export interface VideosResponse {
  id: number;
  results: Video[];
}

export interface TmdbImage {
  file_path: string;
  vote_count: number;
  vote_average: number;
  width: number;
  height: number;
  aspect_ratio: number;
  iso_639_1: string | null;
}

export interface ImagesResponse {
  id: number;
  backdrops: TmdbImage[];
  logos?: TmdbImage[];
  posters?: TmdbImage[];
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
      free?: WatchProvider[];
      flatrate?: WatchProvider[];
      rent?: WatchProvider[];
      buy?: WatchProvider[];
    };
  };
}

export type ListType = 'watchlist' | 'watched';

export type FilterType = 'all' | MediaType;

export type SortOption = 'added';

export interface UserState {
  apiKey: string;
  watchlist: Media[];
  watched: Media[];
  gistId?: string;
  gistToken?: string;
  filter?: FilterType;
  sort?: SortOption;
  showWatched?: boolean;
  showFavoritesOnly?: boolean;
  isSearchFocused?: boolean;
  playedEpisodes: Record<string, boolean>;
}
