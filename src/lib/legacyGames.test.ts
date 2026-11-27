import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeMediaPreferences } from './mediaPreferences';
import { buildGistPayload, fromGistItem } from './gist';
import { mergeGistChanges } from './gistMerge';
import { validateLibraryPayload } from './libraryPayload';
import { getMediaKey } from './media';
import type { Media } from './types';

const game = (source: 'igdb' | 'rawg' | 'steam'): Media => ({
  id: 620, title: `Archived ${source}`, media_type: 'game', source,
  poster_path: 'https://example.com/game.jpg', backdrop_path: null,
  overview: '', vote_average: 0, popularity: 0,
  date_added: '2026-01-01T00:00:00.000Z', release_date: '2011-04-18',
  isFavorite: true, isPurchased: true, rating: 5, pinnedAt: '2026-01-02T00:00:00.000Z',
});

test('media preferences disable games and recover legacy games-only settings', () => {
  assert.deepEqual(normalizeMediaPreferences(), { movie: true, tv: true, game: false });
  assert.deepEqual(normalizeMediaPreferences({ movie: false, tv: false, game: true }), { movie: true, tv: true, game: false });
  assert.deepEqual(normalizeMediaPreferences({ movie: false, tv: true, game: true }), { movie: false, tv: true, game: false });
  assert.deepEqual(normalizeMediaPreferences({ movie: true, tv: false, game: true }), { movie: true, tv: false, game: false });
});

test('all legacy game sources survive Gist validation, decoding, and backup serialization', () => {
  for (const source of ['igdb', 'rawg', 'steam'] as const) {
    const archived = game(source);
    const payload = buildGistPayload([archived], []);
    assert.equal(validateLibraryPayload(JSON.parse(JSON.stringify(payload))).success, true);
    for (const version of [1, 2, 3, 4, 5]) {
      assert.equal(validateLibraryPayload({ ...payload, version }).success, true);
    }
    const restored = fromGistItem(payload.watchlist[0], true);
    assert.equal(getMediaKey(restored), getMediaKey(archived));
    assert.equal(restored.isPurchased, true);
    assert.equal(restored.isFavorite, true);
    assert.equal(restored.rating, 5);
    assert.equal(restored.pinnedAt, archived.pinnedAt);
    assert.deepEqual(buildGistPayload([restored], []), payload);
  }
});

test('movie edits preserve remote additions and legacy game favorites during Gist merging', () => {
  const archived = game('igdb');
  const baseline = buildGistPayload([archived], []);
  const movie: Media = { ...archived, id: 7, title: 'Movie', media_type: 'movie', source: 'tmdb', isPurchased: undefined, isFavorite: false };
  const remote = buildGistPayload([archived], [game('steam')]);
  const local = buildGistPayload([archived, movie], []);
  const merged = mergeGistChanges(remote, baseline, local);
  assert.deepEqual(merged.watchlist.find((item) => item.media_type === 'game'), baseline.watchlist[0]);
  assert.deepEqual(merged.watched, remote.watched);
  assert.deepEqual(new Set(merged.favorites.map((item) => item.source)), new Set(['igdb', 'steam']));
});
