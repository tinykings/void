import type { EnabledMediaTypes, Media, TmdbResult } from './types';

const HIDDEN_TV_GENRES = new Set([10763, 10764, 10767]); // News, Reality, Talk

/** iOS filmography order: 6 movies, 6 shows, repeated, then a popularity mix. */
export const curatePersonCredits = (
  credits: readonly TmdbResult[],
  enabled: Pick<EnabledMediaTypes, 'movie' | 'tv'> = { movie: true, tv: true },
  limit = 30,
): Media[] => {
  const seen = new Set<string>();
  const eligible = credits
    .filter((item) => (item.media_type === 'movie' || item.media_type === 'tv') && enabled[item.media_type])
    .filter((item) => item.media_type !== 'tv' || !(item.genre_ids || []).some((id) => HIDDEN_TV_GENRES.has(id)))
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .filter((item) => {
      const key = `${item.media_type}-${item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const movies = eligible.filter((item) => item.media_type === 'movie');
  const shows = eligible.filter((item) => item.media_type === 'tv');
  const curated = [
    ...movies.slice(0, 6), ...shows.slice(0, 6),
    ...movies.slice(6, 12), ...shows.slice(6, 12),
    ...[...movies.slice(12), ...shows.slice(12)].sort((a, b) => (b.popularity || 0) - (a.popularity || 0)),
  ];
  return curated.slice(0, Math.max(0, Math.min(limit, 30)));
};
