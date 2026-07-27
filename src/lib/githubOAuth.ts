import type { GistLibraryData } from './gist';

const AUTH_APP = 'juice';
const GIST_FILENAME = 'void-data.json';
const LEGACY_GIST_FILENAME = 'void-library.json';
const GIST_DESCRIPTION = 'Void Sync Data';
const POPUP_TIMEOUT_MS = 2 * 60 * 1000;

const getAuthUrl = () => (process.env.GIST_AUTH_URL || '').replace(/\/+$/, '');

const githubHeaders = (token: string) => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'X-GitHub-Api-Version': '2022-11-28',
});

type OAuthMessage = {
  type?: unknown;
  code?: unknown;
  error?: unknown;
};

type GistSummary = {
  id?: unknown;
  files?: Record<string, unknown>;
};

export type GithubConnection = {
  token: string;
  login: string;
};

export const connectGithub = (): Promise<GithubConnection> => {
  const authUrl = getAuthUrl();
  if (!authUrl) return Promise.reject(new Error('GitHub connection is not configured.'));

  const workerOrigin = new URL(authUrl).origin;
  const startUrl = new URL(`${authUrl}/auth/github/start`);
  startUrl.searchParams.set('app', AUTH_APP);
  startUrl.searchParams.set('origin', window.location.origin);

  const popup = window.open(startUrl.toString(), 'void-github-oauth', 'popup=yes,width=600,height=760');
  if (!popup) return Promise.reject(new Error('Popup blocked. Allow popups, then try again.'));

  return new Promise((resolve, reject) => {
    let settled = false;
    let redeeming = false;
    let closedTimer = 0;
    let timeout = 0;
    const finish = (error?: Error, connection?: GithubConnection) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', onMessage);
      window.clearInterval(closedTimer);
      window.clearTimeout(timeout);
      if (!popup.closed) popup.close();
      if (error) reject(error);
      else if (connection) resolve(connection);
    };

    const onMessage = async (event: MessageEvent<OAuthMessage>) => {
      if (event.origin !== workerOrigin || event.source !== popup || event.data?.type !== 'gist-oauth:complete' || redeeming) return;
      redeeming = true;
      window.clearInterval(closedTimer);

      if (typeof event.data.error === 'string' && event.data.error) {
        finish(new Error(event.data.error));
        return;
      }
      if (typeof event.data.code !== 'string' || !event.data.code) {
        finish(new Error('GitHub did not return an authorization code.'));
        return;
      }

      try {
        const response = await fetch(`${authUrl}/auth/redeem`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: event.data.code }),
        });
        if (!response.ok) throw new Error(`GitHub connection failed: ${response.status}`);

        const result = await response.json() as Partial<GithubConnection>;
        if (!result.token || !result.login) throw new Error('GitHub returned an invalid connection response.');
        finish(undefined, { token: result.token, login: result.login });
      } catch (error) {
        finish(error instanceof Error ? error : new Error('Could not connect GitHub.'));
      }
    };

    window.addEventListener('message', onMessage);
    closedTimer = window.setInterval(() => {
      if (popup.closed) finish(new Error('GitHub connection was cancelled.'));
    }, 500);
    timeout = window.setTimeout(() => finish(new Error('GitHub connection timed out.')), POPUP_TIMEOUT_MS);
  });
};

export const findOrCreateAppGist = async (
  token: string,
  initialData: GistLibraryData,
): Promise<string> => {
  for (let page = 1; page <= 10; page += 1) {
    const response = await fetch(`https://api.github.com/gists?per_page=100&page=${page}`, {
      headers: githubHeaders(token),
    });
    if (!response.ok) throw new Error(`Could not find sync Gist: ${response.status}`);

    const gists = await response.json() as GistSummary[];
    const match = gists.find((gist) => gist.files && (
      GIST_FILENAME in gist.files || LEGACY_GIST_FILENAME in gist.files
    ));
    if (match && typeof match.id === 'string') return match.id;
    if (gists.length < 100) break;
  }

  const response = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: {
      ...githubHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      description: GIST_DESCRIPTION,
      public: false,
      files: {
        [GIST_FILENAME]: {
          content: JSON.stringify(initialData, null, 2),
        },
      },
    }),
  });
  if (!response.ok) throw new Error(`Could not create sync Gist: ${response.status}`);

  const gist = await response.json() as GistSummary;
  if (typeof gist.id !== 'string') throw new Error('GitHub returned an invalid Gist.');
  return gist.id;
};
