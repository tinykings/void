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
  status?: string;
  date_added?: string;
  lastChecked?: number;
  isEdited?: boolean;
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
  vote_average: number;
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

export interface ExternalPlayerOption {
  id: string;
  name: string;
  tvUrlTemplate: string;
  movieUrlTemplate: string;
  seriesUrlTemplate?: string;
}

export const externalPlayerOptions: ExternalPlayerOption[] = [
  {
    id: 'cineby.gd',
    name: 'Cineby.gd',
    tvUrlTemplate: 'https://www.cineby.gd/tv/{TMDBID}/{season_num}/{episode_num}?play=true',
    movieUrlTemplate: 'https://www.cineby.gd/movie/{TMDBID}?play=true',
  },
  {
    id: 'bitcine.app',
    name: 'Bitcine.app',
    tvUrlTemplate: 'https://www.bitcine.app/tv/{TMDBID}/{season_num}/{episode_num}?play=true',
    movieUrlTemplate: 'https://www.bitcine.app/movie/{TMDBID}?play=true',
  },
  {
    id: 'fmovies.gd',
    name: 'Fmovies.gd',
    tvUrlTemplate: 'https://www.fmovies.gd/watch/tv/{TMDBID}/{season_num}/{episode_num}?play=true',
    movieUrlTemplate: 'https://www.fmovies.gd/watch/movie/{TMDBID}?play=true',
    seriesUrlTemplate: 'https://www.fmovies.gd/tv/{TMDBID}',
  },
  {
    id: 'xprime.today',
    name: 'XPrime',
    tvUrlTemplate: 'https://xprime.today/watch/{TMDBID}/{season_num}/{episode_num}',
    movieUrlTemplate: 'https://xprime.today/watch/{TMDBID}',
    seriesUrlTemplate: 'https://xprime.today/title/t{TMDBID}',
  },
  {
    id: 'rivestream.org',
    name: 'RiveStream',
    tvUrlTemplate: 'https://rivestream.org/watch?type=tv&id={TMDBID}&season={season_num}&episode={episode_num}',
    movieUrlTemplate: 'https://rivestream.org/watch?type=movie&id={TMDBID}',
    seriesUrlTemplate: 'https://rivestream.org/detail?type=tv&id={TMDBID}',
  },
  // Add other external player options here in the future
];

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

export type FilterType = 'movie' | 'tv';

export type SortOption = 'added' | 'title' | 'release';

export interface UserState {
  apiKey: string;
  watchlist: Media[];
  watched: Media[];
  tmdbSessionId?: string;
  tmdbAccountId?: number;
  vidAngelEnabled?: boolean;
  externalPlayerEnabled?: boolean;
  selectedExternalPlayerId?: string | null;
  filter?: FilterType;
  sort?: SortOption;
  showWatched?: boolean;
  showEditedOnly?: boolean;
  isSearchFocused?: boolean;
  onboardingCompleted?: boolean;
  editedStatusMap: Record<string, boolean>;
}
