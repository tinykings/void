import assert from 'node:assert/strict';
import test from 'node:test';
import type { GistLibraryData, GistLibraryItem } from './gist';
import { mergeGistChanges } from './gistMerge';

const item = (id: number, title: string): GistLibraryItem => ({
  id,
  title,
  media_type: 'movie',
  source: 'tmdb',
  date_added: '2026-01-01T00:00:00.000Z',
});
const payload = (watchlist: GistLibraryItem[] = [], watched: GistLibraryItem[] = []): GistLibraryData => ({
  version: 4,
  watchlist,
  watched,
  favorites: [],
  playedEpisodes: {},
});

test('mergeGistChanges preserves remote additions while applying local moves', () => {
  const localMovie = item(1, 'Local movie');
  const remoteHistory = item(2, 'Remote history');
  const baseline = payload([localMovie]);
  const local = payload([], [localMovie]);
  const remote = payload([localMovie], [remoteHistory]);

  const merged = mergeGistChanges(remote, baseline, local);

  assert.deepEqual(merged.watchlist, []);
  assert.deepEqual(new Set(merged.watched.map(({ id }) => id)), new Set([remoteHistory.id, localMovie.id]));
});

test('mergeGistChanges accepts an intentionally empty remote when local cache did not change', () => {
  const stale = item(1, 'Stale cache');
  const baseline = payload([], [stale]);

  assert.deepEqual(mergeGistChanges(payload(), baseline, baseline), payload());
});

test('mergeGistChanges applies local removals without removing unrelated remote items', () => {
  const removedLocally = item(1, 'Remove me');
  const remoteHistory = item(2, 'Keep me');
  const merged = mergeGistChanges(
    payload([], [removedLocally, remoteHistory]),
    payload([], [removedLocally]),
    payload(),
  );

  assert.deepEqual(merged.watched, [remoteHistory]);
});

test('mergeGistChanges keeps favorite state when item moves to playlist', () => {
  const favorite = item(3, 'Returning favorite');
  const baseline = { ...payload([], [favorite]), favorites: [favorite] };
  const local = { ...payload([favorite]), favorites: [favorite] };

  const merged = mergeGistChanges(baseline, baseline, local);

  assert.deepEqual(merged.watchlist, [favorite]);
  assert.deepEqual(merged.favorites, [favorite]);
});

test('mergeGistChanges merges favorite and episode changes', () => {
  const watched = item(1, 'Favorite');
  const baseline = payload([], [watched]);
  const local = { ...payload([], [watched]), favorites: [watched], playedEpisodes: { '9-1-1': true } };
  const remote = { ...payload([], [watched]), playedEpisodes: { '8-1-1': true } };

  const merged = mergeGistChanges(remote, baseline, local);

  assert.deepEqual(merged.favorites, [watched]);
  assert.deepEqual(merged.playedEpisodes, { '8-1-1': true, '9-1-1': true });
});
