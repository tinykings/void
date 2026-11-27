import { getMediaKey, getMediaSource, getMediaTitle } from './media';
import type { Media, MediaSource, MediaType } from './types';

const TYPE_LABELS: Record<MediaType, string> = { movie: 'Movie', tv: 'Show', game: 'Game' };
const SOURCE_LABELS: Record<MediaSource, string> = { tmdb: 'TMDB', igdb: 'IGDB', rawg: 'RAWG', steam: 'Steam' };
const oneLine = (text: string) => text.replace(/[\r\n\u0085\u2028\u2029]+/g, ' ').trim();

const sortedUnique = (items: readonly Media[]) => {
  const unique = new Map<string, Media>();
  for (const item of items) {
    const key = getMediaKey(item);
    if (!unique.has(key)) unique.set(key, item);
  }
  return [...unique.values()].sort((a, b) =>
    oneLine(getMediaTitle(a)).localeCompare(oneLine(getMediaTitle(b)), 'en')
    || getMediaKey(a).localeCompare(getMediaKey(b), 'en'));
};

const formatItem = (item: Media) => {
  const title = oneLine(getMediaTitle(item)) || 'Unknown title';
  const date = item.release_date || item.first_air_date;
  const year = date?.match(/^(\d{4})(?:-|$)/)?.[1];
  const rating = typeof item.rating === 'number' && Number.isInteger(item.rating) && item.rating >= 1 && item.rating <= 5
    ? ` | Rating: ${item.rating}` : '';
  return `- ${title} — ${TYPE_LABELS[item.media_type]}${year ? ` (${year})` : ''}${rating} | ${SOURCE_LABELS[getMediaSource(item)]}: ${item.id}`;
};

const section = (title: string, items: readonly Media[]) => {
  const sorted = sortedUnique(items);
  return `${title} (${sorted.length})\n${sorted.length ? sorted.map(formatItem).join('\n') : 'None'}`;
};

/** A readable report, not a restore format. Favorites also remain in their saved list. */
export const buildLibraryText = (watchlist: readonly Media[], watched: readonly Media[]): string =>
  '[void] Library\n\n' + [
    section('Favorites', [...watchlist, ...watched].filter((item) => item.isFavorite)),
    section('Playlist', watchlist),
    section('History', watched),
  ].join('\n\n') + '\n';
