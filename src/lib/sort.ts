import { Media } from './types';

export type SortOption = 'added' | 'title' | 'release';

export const sortMedia = (list: Media[], sort: SortOption): Media[] => {
  const sorted = [...list];
  switch (sort) {
    case 'title':
      return sorted.sort((a, b) => {
        const titleA = a.title || a.name || '';
        const titleB = b.title || b.name || '';
        return titleA.localeCompare(titleB);
      });
    case 'release':
      return sorted.sort((a, b) => {
        const dateA = new Date(a.release_date || a.first_air_date || '0').getTime();
        const dateB = new Date(b.release_date || b.first_air_date || '0').getTime();
        return dateB - dateA; // Newest first
      });
    case 'added':
    default:
      // Assuming list is in insertion order (oldest -> newest), we reverse it for "Recently Added"
      return sorted.reverse();
  }
};
