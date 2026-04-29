import { Media } from './types';

const DAY_MS = 1000 * 60 * 60 * 24;
const MOVIE_PRIORITY_WINDOW_DAYS = 30;

const getRelevantDate = (item: Media) => {
  const dateStr =
    (item.media_type === 'tv' && item.next_episode_to_air?.air_date) ||
    item.release_date ||
    item.first_air_date;

  return dateStr ? new Date(dateStr).getTime() : null;
};

const isUpcomingTv = (item: Media, nowTime: number) => {
  const date = getRelevantDate(item);

  if (!date || isNaN(date)) return false;

  const diffDays = Math.ceil((date - nowTime) / DAY_MS);
  return item.media_type === 'tv' && !!item.next_episode_to_air && diffDays >= -3;
};

const isPriorityMovie = (item: Media, nowTime: number) => {
  if (item.media_type !== 'movie') return false;

  const date = getRelevantDate(item);
  if (!date || isNaN(date)) return false;

  const diffDays = Math.ceil((date - nowTime) / DAY_MS);
  return diffDays >= -MOVIE_PRIORITY_WINDOW_DAYS && diffDays <= MOVIE_PRIORITY_WINDOW_DAYS;
};

const sortByAddedWithReleasePriority = (list: Media[]) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const nowTime = now.getTime();

  const upcoming: Media[] = [];
  const added: Media[] = [];

  list.forEach((item) => {
    if (isUpcomingTv(item, nowTime) || isPriorityMovie(item, nowTime)) {
      upcoming.push(item);
    } else {
      added.push(item);
    }
  });

  upcoming.sort((a, b) => (getRelevantDate(a) || 0) - (getRelevantDate(b) || 0));
  added.sort((a, b) => {
    const dateA = new Date(a.date_added || '0').getTime();
    const dateB = new Date(b.date_added || '0').getTime();
    return dateB - dateA;
  });

  return [...upcoming, ...added];
};

export const sortMedia = (list: Media[]): Media[] => {
  return sortByAddedWithReleasePriority(list);
};
