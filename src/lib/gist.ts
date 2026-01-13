import { Media } from './types';

const FILENAME = 'void_data.json';

export const fetchGistData = async (token: string, gistId: string) => {
  const response = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Accept': 'application/vnd.github+json',
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    if (response.status === 404) throw new Error('Gist not found');
    if (response.status === 401) throw new Error('Invalid GitHub Token');
    throw new Error('Failed to fetch Gist');
  }

  const data = await response.json();
  const file = data.files[FILENAME];

  if (!file) return null; // File doesn't exist yet, which is fine
  
  try {
    return JSON.parse(file.content);
  } catch (e) {
    console.error("Error parsing Gist JSON", e);
    return null;
  }
};

export const updateGistData = async (token: string, gistId: string, data: { watchlist: Media[], watched: Media[] }) => {
  const response = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      files: {
        [FILENAME]: {
          content: JSON.stringify(data, null, 2)
        }
      }
    })
  });

  if (!response.ok) throw new Error('Failed to update Gist');
  return response.json();
};
