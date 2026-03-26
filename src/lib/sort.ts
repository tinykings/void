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
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const nowTime = now.getTime();
      
      const getRelevantDate = (item: Media) => {
        const dateStr = (item.media_type === 'tv' && item.next_episode_to_air?.air_date) || 
                        item.release_date || 
                        item.first_air_date;
        return dateStr ? new Date(dateStr).getTime() : null;
      };

      const upcoming: Media[] = [];
      const released: Media[] = [];

      list.forEach((item) => {
        const date = getRelevantDate(item);
        if (date && !isNaN(date)) {
          const diffDays = Math.ceil((date - nowTime) / (1000 * 60 * 60 * 24));
          const isNextEpisode = item.media_type === 'tv' && item.next_episode_to_air;
          
          // Include in upcoming if it's in the future OR it's a TV show next episode in the "recent past" (within 3 days)
          if (diffDays > 0 || (isNextEpisode && diffDays >= -3)) {
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
    case 'added':
    default:
      return [...list].sort((a, b) => {
        const dateA = new Date(a.date_added || '0').getTime();
        const dateB = new Date(b.date_added || '0').getTime();
        return dateB - dateA; // Newest first
      });
  }
};
