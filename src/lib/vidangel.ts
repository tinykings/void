export const checkVidAngelAvailability = async (title: string, tmdbId: number): Promise<boolean> => {
  if (!title || !tmdbId) return false;
  
  try {
    const response = await fetch(`https://api.vidangel.com/api/content/v2/works/?query=${encodeURIComponent(title)}&limit=1`, {
      credentials: 'include'
    });
    
    if (!response.ok) return false;
    
    const data = await response.json();
    
    if (data.results && Array.isArray(data.results) && data.results.length > 0) {
      const result = data.results[0];
      const posterUrl = result.poster_url;
      
      if (!posterUrl) return false;

      // The ID is consistently preceded by a dash and followed by an underscore or dot
      // e.g., movie-798645_... or movies-773975_... or show-12345_...
      const idStr = tmdbId.toString();
      const patterns = [
        `-${idStr}_`,
        `-${idStr}.`,
        `-${idStr}-`
      ];

      return patterns.some(pattern => posterUrl.includes(pattern));
    }
    
    return false;
  } catch (error) {
    console.error("VidAngel API check failed", error);
    return false;
  }
};