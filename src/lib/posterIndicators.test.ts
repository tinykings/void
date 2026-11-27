import assert from 'node:assert/strict';
import test from 'node:test';
import { getPosterIndicator, POSTER_INDICATOR_CLASSES } from './posterIndicators';

type State = Parameters<typeof getPosterIndicator>[0];
const base: State = { context: 'library', isPinned: false, isFavorite: false, inPlaylist: false, inHistory: false, isUpcoming: false };

test('library pins take priority; Playlist and History favorites get the same accent', () => {
  assert.equal(getPosterIndicator({ ...base, inPlaylist: true, isPinned: true, isFavorite: true }), 'pinned');
  assert.equal(getPosterIndicator({ ...base, inPlaylist: true, isFavorite: true }), 'favorite');
  assert.equal(getPosterIndicator({ ...base, inHistory: true, isFavorite: true }), 'favorite');
  assert.equal(getPosterIndicator({ ...base, inHistory: true }), 'neutral');
  assert.equal(getPosterIndicator({ ...base, inPlaylist: true, isUpcoming: true }), 'neutral');
  assert.equal(getPosterIndicator({ ...base, isPinned: true, isFavorite: true, isUpcoming: true }), 'neutral');
});

test('search priority is favorite, Playlist, History, upcoming, then neutral', () => {
  const search = { ...base, context: 'search' as const, isUpcoming: true };
  assert.equal(getPosterIndicator({ ...search, inPlaylist: true, isPinned: true, isFavorite: true }), 'favorite');
  assert.equal(getPosterIndicator({ ...search, inHistory: true, isFavorite: true }), 'favorite');
  assert.equal(getPosterIndicator({ ...search, inPlaylist: true, isPinned: true }), 'playlist');
  assert.equal(getPosterIndicator({ ...search, inHistory: true }), 'history');
  assert.equal(getPosterIndicator(search), 'upcoming');
  assert.equal(getPosterIndicator({ ...search, isUpcoming: false }), 'neutral');
  assert.equal(getPosterIndicator({ ...search, isFavorite: true }), 'upcoming', 'unsaved stale favorite flags cannot claim library status');
});

test('border classes keep iOS widths and semantic colors without affecting poster layout', () => {
  assert.equal(POSTER_INDICATOR_CLASSES.pinned, 'border-[2.5px] border-brand-cyan');
  assert.equal(POSTER_INDICATOR_CLASSES.playlist, 'border border-brand-cyan');
  assert.equal(POSTER_INDICATOR_CLASSES.favorite, 'border border-brand-favorite');
  assert.equal(POSTER_INDICATOR_CLASSES.history, 'border border-brand-history');
  assert.equal(POSTER_INDICATOR_CLASSES.upcoming, 'border-2 border-brand-upcoming');
  assert.equal(POSTER_INDICATOR_CLASSES.neutral, 'border border-blueprint-border');
});
