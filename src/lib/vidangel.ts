export const checkVidAngelAvailability = async (title: string, tmdbId: number): Promise<string | null> => {
  if (!title || !tmdbId) return null;
  
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
          return result.slug;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error("VidAngel API check failed", error);
    return null;
  }
};