import assert from 'node:assert/strict';
import test from 'node:test';
import { isDateInLocalDayWindow, toggleWatchedInLibrary, toggleWatchlistInLibrary } from './library';
import type { Media } from './types';

const media = (id: number, media_type: Media['media_type'] = 'movie', source?: Media['source']): Media => ({
  id,
  title: `Title ${id}`,
  poster_path: null,
  backdrop_path: null,
  overview: '',
  vote_average: 0,
  popularity: 0,
  media_type,
  source,
});

test('adding to playlist removes matching item from history only', () => {
  const selected = media(7);
  const sameNumericIdDifferentType = media(7, 'tv');
  const result = toggleWatchlistInLibrary([], [selected, sameNumericIdDifferentType], selected, '2026-01-02T00:00:00.000Z');

  assert.deepEqual(result.watchlist, [{ ...selected, date_added: '2026-01-02T00:00:00.000Z' }]);
  assert.deepEqual(result.watched, [sameNumericIdDifferentType]);
});

test('adding to history removes matching item from playlist', () => {
  const selected = media(8);
  const result = toggleWatchedInLibrary([selected], [], selected, 5, '2026-01-02T00:00:00.000Z', 1234);

  assert.deepEqual(result.watchlist, []);
  assert.deepEqual(result.watched, [{
    ...selected,
    rating: 5,
    date_added: '2026-01-02T00:00:00.000Z',
    lastChecked: 1234,
  }]);
});

test('rating update preserves metadata and collapses legacy duplicates', () => {
  const selected = media(9);
  const original = { ...selected, overview: 'Preserve me', date_added: 'old', isFavorite: true, rating: 2 };
  const duplicate = { ...selected, date_added: 'duplicate', rating: 1 };
  const result = toggleWatchedInLibrary([selected], [original, duplicate], selected, 4);

  assert.deepEqual(result.watchlist, []);
  assert.deepEqual(result.watched, [{ ...original, rating: 4 }]);
});

test('history toggle without rating removes existing item', () => {
  const selected = media(10);
  assert.deepEqual(toggleWatchedInLibrary([], [selected], selected).watched, []);
});

test('TV migration window includes today and day seven only', () => {
  const now = new Date(2026, 5, 10, 15, 30);

  assert.equal(isDateInLocalDayWindow('2026-06-10', now, 7), true);
  assert.equal(isDateInLocalDayWindow('2026-06-17', now, 7), true);
  assert.equal(isDateInLocalDayWindow('2026-06-09', now, 7), false);
  assert.equal(isDateInLocalDayWindow('2026-06-18', now, 7), false);
  assert.equal(isDateInLocalDayWindow('2026-02-30', now, 7), false);
  assert.equal(isDateInLocalDayWindow('not-a-date', now, 7), false);
});
