import assert from 'node:assert/strict';
import test from 'node:test';
import { findOrCreateAppGist } from './githubOAuth';
import type { GistLibraryData } from './gist';

const originalFetch = globalThis.fetch;
const emptyLibrary: GistLibraryData = {
  version: 3,
  watchlist: [],
  watched: [],
  favorites: [],
  playedEpisodes: {},
};

test('findOrCreateAppGist reuses Gist containing app filename', async () => {
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return Response.json([{ id: 'existing-id', files: { 'void-data.json': {} } }]);
  };

  assert.equal(await findOrCreateAppGist('token', emptyLibrary), 'existing-id');
  assert.equal(requests, 1);
});

test('findOrCreateAppGist creates private app Gist when missing', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), init });
    if (!init?.method) return Response.json([]);
    return Response.json({ id: 'new-id' }, { status: 201 });
  };

  assert.equal(await findOrCreateAppGist('token', emptyLibrary), 'new-id');
  const createRequest = requests[1];
  const body = JSON.parse(String(createRequest.init?.body));
  assert.equal(createRequest.url, 'https://api.github.com/gists');
  assert.equal(createRequest.init?.method, 'POST');
  assert.equal(body.description, 'Void Sync Data');
  assert.equal(body.public, false);
  assert.deepEqual(JSON.parse(body.files['void-data.json'].content), emptyLibrary);
});

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});
