import assert from 'node:assert/strict';
import test from 'node:test';
import { getGistContent, isEmptyGistPayload, type GistLibraryData } from './gist';

const originalFetch = globalThis.fetch;

const gistResponse = (content: unknown, filename = 'void-library.json') =>
  new Response(JSON.stringify({ files: { [filename]: { content } } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const emptyLibrary: GistLibraryData = {
  version: 2,
  watchlist: [],
  watched: [],
  favorites: [],
};

test('getGistContent distinguishes safe initialization from read failures', async (t) => {
  await t.test('throws for GitHub HTTP failures instead of treating them as empty', async () => {
    for (const status of [403, 404, 500]) {
      globalThis.fetch = async () => new Response(null, { status });
      await assert.rejects(getGistContent('gist-id', 'token'), new RegExp(String(status)));
    }
  });

  await t.test('throws when the GitHub response body is not JSON', async () => {
    globalThis.fetch = async () => new Response('{not-json', { status: 200 });
    await assert.rejects(getGistContent('gist-id'), /GitHub returned invalid JSON/);
  });

  await t.test('reports a missing named library file without reading an unrelated file', async () => {
    globalThis.fetch = async () => gistResponse(JSON.stringify(emptyLibrary), 'notes.txt');
    assert.deepEqual(await getGistContent('gist-id'), { status: 'missing' });
  });

  await t.test('reports a blank named file as empty', async () => {
    globalThis.fetch = async () => gistResponse('  \n ');
    assert.deepEqual(await getGistContent('gist-id'), { status: 'empty' });
  });

  await t.test('reports malformed JSON as invalid', async () => {
    globalThis.fetch = async () => gistResponse('{broken');
    assert.deepEqual(await getGistContent('gist-id'), {
      status: 'invalid',
      reason: 'void-library.json contains invalid JSON',
    });
  });

  await t.test('reports an unsupported payload shape as invalid', async () => {
    globalThis.fetch = async () => gistResponse(JSON.stringify({ version: 2, watchlist: [] }));
    const result = await getGistContent('gist-id');
    assert.equal(result.status, 'invalid');
  });

  await t.test('loads and identifies a valid empty library', async () => {
    globalThis.fetch = async () => gistResponse(JSON.stringify(emptyLibrary));
    const result = await getGistContent('gist-id');
    assert.equal(result.status, 'loaded');
    if (result.status === 'loaded') assert.equal(isEmptyGistPayload(result.data), true);
  });

  await t.test('loads a valid non-empty library', async () => {
    const library: GistLibraryData = {
      ...emptyLibrary,
      watchlist: [{
        id: 1,
        title: 'Example',
        media_type: 'movie',
        date_added: '2026-01-01T00:00:00.000Z',
      }],
    };
    globalThis.fetch = async () => gistResponse(JSON.stringify(library));
    const result = await getGistContent('gist-id');
    assert.deepEqual(result, { status: 'loaded', data: library });
  });

  await t.test('authenticates reads when a token is supplied', async () => {
    let authorization: string | null = null;
    globalThis.fetch = async (_input, init) => {
      authorization = new Headers(init?.headers).get('Authorization');
      return gistResponse(JSON.stringify(emptyLibrary));
    };
    await getGistContent('gist-id', 'secret-token');
    assert.equal(authorization, 'Bearer secret-token');
  });
});

test.after(() => {
  globalThis.fetch = originalFetch;
});
