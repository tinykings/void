// TMDB air dates are calendar days, not UTC instants. Missing/invalid dates stay hidden.
export const hasEpisodeAired = (airDate: string | undefined, now = new Date()) => {
  if (!airDate || !/^\d{4}-\d{2}-\d{2}$/.test(airDate)) return false;
  const [year, month, day] = airDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return false;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return date.getTime() <= today.getTime();
};

export const scrambleSummary = (text: string) => text.replace(/[\p{L}\p{N}]/gu, '░');
