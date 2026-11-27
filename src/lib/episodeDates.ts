// TMDB air dates represent local calendar days.
export const getEpisodeAirDate = (airDate: string | null | undefined, now = new Date()) => {
  if (!airDate || !/^\d{4}-\d{2}-\d{2}$/.test(airDate)) return null;
  const [year, month, day] = airDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return { date, aired: date.getTime() <= today.getTime() };
};
