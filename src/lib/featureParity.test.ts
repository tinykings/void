import assert from 'node:assert/strict';
import test from 'node:test';
import type { Media } from './types';
import { buildGistPayload, fromGistItem } from './gist';
import { validateLibraryPayload } from './libraryPayload';
import { mergeGistChanges } from './gistMerge';
import { sortMedia } from './sort';
import { toggleWatchedInLibrary, toggleWatchlistInLibrary } from './library';
import { hasEpisodeAired, scrambleSummary } from './episodeSpoilers';
import { getRecommendations } from './tmdb';

const movie = (id: number, pinnedAt?: string): Media => ({
  id, title: `Movie ${id}`, media_type: 'movie', source: 'tmdb',
  poster_path: null, backdrop_path: null, overview: '', vote_average: 0, popularity: 0,
  date_added: `2026-01-0${id}T00:00:00.000Z`, ...(pinnedAt ? { pinnedAt } : {}),
});
const pin = '2026-02-01T00:00:00.000Z';

test('pins round-trip through v6 Gist and reject invalid pin dates', () => {
  const payload = buildGistPayload([movie(1, pin)], []);
  assert.equal(payload.version, 6);
  assert.equal(validateLibraryPayload(payload).success, true);
  assert.equal(fromGistItem(payload.watchlist[0]).pinnedAt, pin);
  assert.equal(validateLibraryPayload({ ...payload, watchlist: [{ ...payload.watchlist[0], pinnedAt: 'bad' }] }).success, false);
  for (const version of [1, 2, 3, 4, 5]) assert.equal(validateLibraryPayload({ ...payload, version, watchlist: [] }).success, true);
});

test('pins sort before other Playlist items, newest pin first; unpinned order stays unchanged', () => {
  assert.deepEqual(sortMedia([movie(1, pin), movie(2, '2026-03-01T00:00:00.000Z'), movie(3), movie(4)]).map((item) => item.id), [2, 1, 4, 3]);
});

test('moving lists clears pins, including when details carries stale pin metadata', () => {
  const pinned = movie(1, pin);
  assert.equal(toggleWatchedInLibrary([pinned], [], pinned).watched[0].pinnedAt, undefined);
  assert.equal(toggleWatchlistInLibrary([], [pinned], pinned).watchlist[0].pinnedAt, undefined);
});

test('local pin and unpin merge independently of remote metadata and favorites', () => {
  const baseline = buildGistPayload([movie(1)], []);
  const updated = { ...movie(1), title: 'Remote title', isFavorite: true };
  const remote = buildGistPayload([updated], []);
  const merged = mergeGistChanges(remote, baseline, buildGistPayload([movie(1, pin)], []));
  assert.equal(merged.watchlist[0].title, 'Remote title');
  assert.equal(merged.watchlist[0].pinnedAt, pin);
  assert.equal(merged.favorites.length, 1);
  const unpinned = mergeGistChanges(merged, buildGistPayload([movie(1, pin)], []), baseline);
  assert.equal(unpinned.watchlist[0].pinnedAt, undefined);
  assert.equal(unpinned.watchlist[0].title, 'Remote title');
});

test('remote pins survive unrelated local metadata edits and local pins do not resurrect remote deletions', () => {
  const baseline = buildGistPayload([movie(1)], []);
  const remote = buildGistPayload([movie(1, pin)], []);
  const local = buildGistPayload([{ ...movie(1), title: 'Local title' }], []);
  assert.equal(mergeGistChanges(remote, baseline, local).watchlist[0].pinnedAt, pin);
  assert.equal(mergeGistChanges(buildGistPayload([], []), baseline, remote).watchlist.length, 0);
});

test('episode spoiler dates use local days and hide missing, invalid, and future dates', () => {
  const now = new Date(2026, 5, 12, 0, 1);
  assert.equal(hasEpisodeAired('2026-06-11', now), true);
  assert.equal(hasEpisodeAired('2026-06-12', now), true);
  for (const value of [undefined, '', '2026-06-13', '2026-02-30', 'invalid', '2026-06-12T00:00:00Z']) {
    assert.equal(hasEpisodeAired(value, now), false);
  }
  assert.equal(scrambleSummary('Secret 123: résumé.'), '░░░░░░ ░░░: ░░░░░░.');
});

test('recommendations use the seed media type and normalize TMDB results', async () => {
  const originalFetch = globalThis.fetch;
  let requested = '';
  globalThis.fetch = async (url) => {
    requested = String(url);
    return new Response(JSON.stringify({ results: [{ id: 99, name: 'Recommended show', popularity: 10 }] }), { status: 200 });
  };
  try {
    const results = await getRecommendations(1, 'tv', 'test-token');
    assert.match(requested, /\/tv\/1\/recommendations/);
    assert.equal(results[0].media_type, 'tv');
    assert.equal(results[0].source, 'tmdb');
  } finally { globalThis.fetch = originalFetch; }
});
