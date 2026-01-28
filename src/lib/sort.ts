import { Media, SortOption } from './types';

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
    case 'upcoming':
      return sorted.sort((a, b) => {
        const dateA = a.next_episode_to_air?.air_date ? new Date(a.next_episode_to_air.air_date).getTime() : Infinity;
        const dateB = b.next_episode_to_air?.air_date ? new Date(b.next_episode_to_air.air_date).getTime() : Infinity;
        
        if (dateA !== dateB) {
          return dateA - dateB; // Soonest first, Infinity at bottom
        }
        
        // If both are Infinity (no upcoming), sort by added date
        const addedA = new Date(a.date_added || '0').getTime();
        const addedB = new Date(b.date_added || '0').getTime();
        return addedB - addedA;
      });
    case 'added':
    default:
      return sorted.sort((a, b) => {
        const dateA = new Date(a.date_added || '0').getTime();
        const dateB = new Date(b.date_added || '0').getTime();
        return dateB - dateA; // Newest first
      });
  }
};
