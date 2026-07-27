import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGistPayload, fromGistItem, getGistContent, isEmptyGistPayload, type GistLibraryData } from './gist';
import type { Media } from './types';

const originalFetch = globalThis.fetch;

const gistResponse = (content: unknown, filename = 'void-data.json') =>
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

  await t.test('reads legacy Void filename during OAuth migration', async () => {
    globalThis.fetch = async () => gistResponse(JSON.stringify(emptyLibrary), 'void-library.json');
    assert.equal((await getGistContent('gist-id')).status, 'loaded');
  });

  await t.test('reports a blank named file as empty', async () => {
    globalThis.fetch = async () => gistResponse('  \n ');
    assert.deepEqual(await getGistContent('gist-id'), { status: 'empty' });
  });

  await t.test('reports malformed JSON as invalid', async () => {
    globalThis.fetch = async () => gistResponse('{broken');
    assert.deepEqual(await getGistContent('gist-id'), {
      status: 'invalid',
      reason: 'void-data.json contains invalid JSON',
    });
  });

  await t.test('reports an unsupported payload shape as invalid', async () => {
    globalThis.fetch = async () => gistResponse(JSON.stringify({ version: 2, watchlist: [] }));
    const result = await getGistContent('gist-id');
    assert.equal(result.status, 'invalid');
  });

  await t.test('rejects malformed items with a useful field path', async () => {
    globalThis.fetch = async () => gistResponse(JSON.stringify({
      ...emptyLibrary,
      watchlist: [{
        id: 1,
        title: 'Bad item',
        media_type: 'podcast',
        date_added: '2026-01-01T00:00:00.000Z',
      }],
    }));
    assert.deepEqual(await getGistContent('gist-id'), {
      status: 'invalid',
      reason: 'void-data.json: watchlist[0].media_type must be movie, tv, or game',
    });
  });

  await t.test('rejects invalid item fields instead of casting them', async () => {
    const invalidItems = [
      { id: 0, title: 'Title', media_type: 'movie', date_added: '2026-01-01' },
      { id: 1, title: '', media_type: 'movie', date_added: '2026-01-01' },
      { id: 1, title: 'Title', media_type: 'movie', source: 'igdb', date_added: '2026-01-01' },
      { id: 1, title: 'Title', media_type: 'movie', date_added: 'not-a-date' },
      { id: 1, title: 'Title', media_type: 'movie', date_added: '2026-02-30' },
      { id: 1, title: 'Title', media_type: 'movie', date_added: '2026-01-01', rating: 6 },
    ];

    for (const item of invalidItems) {
      globalThis.fetch = async () => gistResponse(JSON.stringify({ ...emptyLibrary, watched: [item] }));
      assert.equal((await getGistContent('gist-id')).status, 'invalid');
    }
  });

  await t.test('rejects unsupported fields', async () => {
    globalThis.fetch = async () => gistResponse(JSON.stringify({
      ...emptyLibrary,
      favorites: [{
        id: 1,
        title: 'Unexpected data',
        media_type: 'movie',
        date_added: '2026-01-01',
        executable: true,
      }],
    }));
    const result = await getGistContent('gist-id');
    assert.equal(result.status, 'invalid');
    if (result.status === 'invalid') assert.match(result.reason, /favorites\[0\] contains unsupported fields/);
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

test('legacy Gist imports restore media defaults and favorites', () => {
  const imported = fromGistItem({
    id: 12,
    title: 'Legacy game',
    media_type: 'game',
    date_added: '2025-03-04T00:00:00.000Z',
  }, true);

  assert.equal(imported.source, 'igdb');
  assert.equal(imported.date_added, '2025-03-04T00:00:00.000Z');
  assert.equal(imported.isFavorite, true);
  assert.equal(imported.poster_path, null);
  assert.equal(imported.backdrop_path, null);
});

test('version 3 payload preserves ratings and played episodes', () => {
  const watched: Media = {
    id: 42,
    title: 'Rated movie',
    poster_path: '/poster.jpg',
    backdrop_path: null,
    overview: '',
    vote_average: 8,
    popularity: 10,
    media_type: 'movie',
    source: 'tmdb',
    date_added: '2026-01-01T00:00:00.000Z',
    rating: 4,
    isFavorite: true,
  };
  const playedEpisodes = { '99-2-3': true };

  const payload = buildGistPayload([], [watched], playedEpisodes);

  assert.equal(payload.version, 3);
  assert.equal(payload.watched[0].rating, 4);
  assert.deepEqual(payload.playedEpisodes, playedEpisodes);
  assert.equal(isEmptyGistPayload(payload), false);
  assert.equal(fromGistItem(payload.watched[0], true).rating, 4);
});

test('version 3 Gist content requires valid played episode data', async () => {
  globalThis.fetch = async () => gistResponse(JSON.stringify({
    version: 3,
    watchlist: [],
    watched: [],
    favorites: [],
  }));
  assert.equal((await getGistContent('gist-id')).status, 'invalid');

  globalThis.fetch = async () => gistResponse(JSON.stringify({
    version: 3,
    watchlist: [],
    watched: [],
    favorites: [],
    playedEpisodes: { '99-2-3': true },
  }));
  assert.equal((await getGistContent('gist-id')).status, 'loaded');
});

test.after(() => {
  globalThis.fetch = originalFetch;
});
