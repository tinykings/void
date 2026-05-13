const cache = new Map<number, string | null>();

export type VidAngelAccessStatus = 'available' | 'blocked' | 'unavailable';

export const checkVidAngelAccess = async (): Promise<VidAngelAccessStatus> => {
  try {
    const response = await fetch('https://api.vidangel.com/api/content/v2/works/', {
      credentials: 'include',
    });

    if (response.status === 403) return 'blocked';
    if (response.ok) return 'available';
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
};

export const checkVidAngelAvailability = async (title: string, tmdbId: number): Promise<string | null> => {
  if (!title || !tmdbId) return null;
  
  if (cache.has(tmdbId)) {
    return cache.get(tmdbId)!;
  }
  
  try {
    const response = await fetch(`https://api.vidangel.com/api/content/v2/works/?query=${encodeURIComponent(title)}&limit=2`, {
      credentials: 'include'
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (data.results && Array.isArray(data.results)) {
      for (const result of data.results) {
        const posterUrl = result.poster_url;
        if (!posterUrl) continue;

        // The ID is consistently preceded by a dash and followed by an underscore or dot
        // e.g., movie-798645_... or movies-773975_... or show-12345_...
        const idStr = tmdbId.toString();
        const patterns = [
          `-${idStr}_`,
          `-${idStr}.`,
          `-${idStr}-`
        ];

        if (patterns.some(pattern => posterUrl.includes(pattern))) {
          cache.set(tmdbId, result.slug);
          return result.slug;
        }
      }
    }
    
    cache.set(tmdbId, null);
    return null;
  } catch {
    cache.set(tmdbId, null);
    return null;
  }
};
