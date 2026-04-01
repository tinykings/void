export interface GistContent {
  url: string;
  title: string;
  timestamp: number;
}

export async function updateGist(gistId: string, token: string, content: GistContent): Promise<void> {
  const response = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: 'PATCH',
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      files: {
        'void-tv.json': {
          content: JSON.stringify(content),
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update gist: ${response.status}`);
  }
}

export async function getGistContent(gistId: string): Promise<GistContent | null> {
  const response = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: {
      'Accept': 'application/vnd.github+json',
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const file = data.files?.['void-tv.json'];
  if (!file?.content) {
    return null;
  }

  try {
    return JSON.parse(file.content) as GistContent;
  } catch {
    return null;
  }
}
