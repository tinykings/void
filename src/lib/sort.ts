import { Media, SortOption } from './types';

export const sortMedia = (list: Media[], sort: SortOption): Media[] => {
  switch (sort) {
    case 'title':
      return [...list].sort((a, b) => {
        const titleA = a.title || a.name || '';
        const titleB = b.title || b.name || '';
        return titleA.localeCompare(titleB);
      });
    case 'release':
      const now = new Date().getTime();
      const upcoming: Media[] = [];
      const released: Media[] = [];

      list.forEach((item) => {
        const dateStr = item.release_date || item.first_air_date;
        if (dateStr) {
          const date = new Date(dateStr).getTime();
          // If valid date and in the future
          if (!isNaN(date) && date > now) {
            upcoming.push(item);
            return;
          }
        }
        released.push(item);
      });

      // Sort upcoming: Soonest to Latest (Ascending)
      upcoming.sort((a, b) => {
        const dateA = new Date(a.release_date || a.first_air_date || '').getTime();
        const dateB = new Date(b.release_date || b.first_air_date || '').getTime();
        return dateA - dateB;
      });

      // Sort released: Newest to Oldest (Descending)
      released.sort((a, b) => {
        const dateA = new Date(a.release_date || a.first_air_date || '0').getTime();
        const dateB = new Date(b.release_date || b.first_air_date || '0').getTime();
        return dateB - dateA;
      });

      return [...upcoming, ...released];
    case 'added':
    default:
      return [...list].sort((a, b) => {
        const dateA = new Date(a.date_added || '0').getTime();
        const dateB = new Date(b.date_added || '0').getTime();
        return dateB - dateA; // Newest first
      });
  }
};
