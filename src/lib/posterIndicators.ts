export type PosterIndicatorContext = 'library' | 'search';
export type PosterIndicator = 'neutral' | 'pinned' | 'favorite' | 'playlist' | 'history' | 'upcoming';

type PosterState = {
  context: PosterIndicatorContext;
  isPinned: boolean;
  isFavorite: boolean;
  inPlaylist: boolean;
  inHistory: boolean;
  isUpcoming: boolean;
};

/** Match iOS: library pins win; search favorites win over list/release status. */
export const getPosterIndicator = (state: PosterState): PosterIndicator => {
  if (state.context === 'library') {
    if (state.inPlaylist && state.isPinned) return 'pinned';
    if (state.inHistory && state.isFavorite) return 'favorite';
    return 'neutral';
  }
  if (state.isFavorite && (state.inPlaylist || state.inHistory)) return 'favorite';
  if (state.inPlaylist) return 'playlist';
  if (state.inHistory) return 'history';
  if (state.isUpcoming) return 'upcoming';
  return 'neutral';
};

export const POSTER_INDICATOR_CLASSES: Record<PosterIndicator, string> = {
  neutral: 'border border-blueprint-border',
  pinned: 'border-[2.5px] border-brand-cyan',
  favorite: 'border border-brand-favorite',
  playlist: 'border border-brand-cyan',
  history: 'border border-brand-history',
  upcoming: 'border-2 border-brand-upcoming',
};
