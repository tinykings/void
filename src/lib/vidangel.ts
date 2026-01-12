export const checkVidAngelAvailability = async (title: string): Promise<boolean> => {
  if (!title) return false;
  
  // Replace spaces with dashes and remove special characters (keep alphanumeric and dashes)
  const slug = title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  try {
    const response = await fetch(`https://api.vidangel.com/api/content/v2/works/?slug=${slug}`, {
      credentials: 'include'
    });
    if (!response.ok) return false;
    
    const data = await response.json();
    
    // Check if we have results and at least one has an ID
    if (data.results && Array.isArray(data.results) && data.results.length > 0) {
      return data.results.some((item: any) => item.id);
    }
    
    return false;
  } catch (error) {
    console.error("VidAngel API check failed", error);
    return false;
  }
};
