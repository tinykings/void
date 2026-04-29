import { Media, SortOption } from './types';

const DAY_MS = 1000 * 60 * 60 * 24;

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

const sortByReleasePriority = (list: Media[]) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const nowTime = now.getTime();

  const upcoming: Media[] = [];
  const released: Media[] = [];

  list.forEach((item) => {
    const date = getRelevantDate(item);
    if (date && !isNaN(date)) {
      const diffDays = Math.ceil((date - nowTime) / DAY_MS);

      // Include in upcoming if it's in the future OR it's a TV show next episode in the "recent past" (within 3 days)
      if (diffDays > 0 || isUpcomingTv(item, nowTime)) {
        upcoming.push(item);
        return;
      }
    }

    released.push(item);
  });

  // Sort upcoming: Soonest to Latest (Ascending)
  upcoming.sort((a, b) => (getRelevantDate(a) || 0) - (getRelevantDate(b) || 0));

  // Sort released: Newest to Oldest (Descending)
  released.sort((a, b) => (getRelevantDate(b) || 0) - (getRelevantDate(a) || 0));

  return [...upcoming, ...released];
};

const sortByAddedWithReleasePriority = (list: Media[]) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const nowTime = now.getTime();

  const upcoming: Media[] = [];
  const added: Media[] = [];

  list.forEach((item) => {
    if (isUpcomingTv(item, nowTime)) {
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

export const sortMedia = (list: Media[], sort: SortOption): Media[] => {
  switch (sort) {
    case 'title':
      return [...list].sort((a, b) => {
        const titleA = a.title || a.name || '';
        const titleB = b.title || b.name || '';
        return titleA.localeCompare(titleB);
      });
    case 'release':
      return sortByReleasePriority(list);
    case 'added':
    default:
      return sortByAddedWithReleasePriority(list);
  }
};
