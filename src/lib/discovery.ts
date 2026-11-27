import { getMediaKey } from './media';
import type { Media } from './types';

export const UPCOMING_DAYS = 30;
export const UPCOMING_EACH = 6;

export const discoveryDay = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const upcomingWindow = (now = new Date()) => {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const end = new Date(now);
  end.setDate(end.getDate() + UPCOMING_DAYS);
  return { from: discoveryDay(tomorrow), to: discoveryDay(end) };
};

/** Premiere dates, not next episodes. Count local calendar days, including across DST. */
export const upcomingReleaseDays = (media: Media, now = new Date()): number | null => {
  if (media.media_type !== 'movie' && media.media_type !== 'tv') return null;
  const value = media.media_type === 'tv' ? media.first_air_date : media.release_date;
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const release = new Date(Date.UTC(year, month - 1, day));
  if (release.getUTCFullYear() !== year || release.getUTCMonth() !== month - 1 || release.getUTCDate() !== day) return null;
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = (release.getTime() - today) / 86_400_000;
  return days >= 1 && days <= UPCOMING_DAYS ? days : null;
};

/** Preserve trending order; insert one upcoming title after every four, then append the rest. */
export const mixDiscovery = (
  trending: readonly Media[],
  movies: readonly Media[],
  shows: readonly Media[],
  now = new Date(),
): Media[] => {
  const seen = new Set<string>();
  const takeUnique = (items: readonly Media[]) => items.filter((item) => {
    if (item.media_type !== 'movie' && item.media_type !== 'tv') return false;
    const key = getMediaKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const popular = takeUnique(trending);
  const upcoming = [movies, shows].map((items) => {
    // Filter and deduplicate before capping, so duplicates don't consume a slot.
    const sorted = [...items].filter((item) => upcomingReleaseDays(item, now) !== null)
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    const selected: Media[] = [];
    for (const item of sorted) {
      if (selected.length === UPCOMING_EACH) break;
      selected.push(...takeUnique([item]));
    }
    return selected;
  });
  const interleaved: Media[] = [];
  for (let i = 0; i < UPCOMING_EACH; i++) {
    for (const list of upcoming) if (list[i]) interleaved.push(list[i]);
  }
  const mixed: Media[] = [];
  let next = 0;
  popular.forEach((item, index) => {
    mixed.push(item);
    if (index % 4 === 3 && next < interleaved.length) mixed.push(interleaved[next++]);
  });
  return [...mixed, ...interleaved.slice(next)];
};
