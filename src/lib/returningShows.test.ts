import assert from 'node:assert/strict';
import test from 'node:test';
import { applyReturningShowCheck, toggleWatchedInLibrary, toggleWatchlistInLibrary } from './library';
import { buildGistPayload, fromGistItem } from './gist';
import { mergeGistChanges } from './gistMerge';
import { validateLibraryPayload } from './libraryPayload';
import type { Media } from './types';
import { useStore } from '../store/useStore';

const now = new Date(2026, 5, 12, 12);
const day = '2026-06-15';
const show: Media = {
  id: 42, title: 'Returning Show', media_type: 'tv', source: 'tmdb',
  poster_path: '/poster.jpg', backdrop_path: null, overview: '', vote_average: 8, popularity: 10,
  date_added: '2026-01-01T00:00:00.000Z', status: 'Returning Series', isFavorite: true, rating: 4,
};
const details = (airDate = day): Media => ({ ...show, next_episode_to_air: {
  air_date: airDate, episode_number: 2, season_number: 1, name: 'Next', overview: '', still_path: null,
} });
const returned = { ...show, returnedFor: day, date_added: now.toISOString() };
const played = { ...returned, date_added: '2026-06-12T13:00:00.000Z' };

test('return once per air date; marking played with stale details preserves the marker and favorites', () => {
  const first = applyReturningShowCheck([], [show], show, details(), now);
  assert.equal(first.returned?.returnedFor, day);
  assert.equal(first.watched.length, 0);
  const marked = toggleWatchedInLibrary(first.watchlist, [], details(), undefined, played.date_added);
  assert.equal(marked.watched[0].returnedFor, day);
  assert.equal(marked.watched[0].isFavorite, true);
  assert.equal(marked.watched[0].rating, 4);
  const repeat = applyReturningShowCheck([], marked.watched, marked.watched[0], details(), now);
  assert.equal(repeat.returned, undefined);
  assert.equal(repeat.watchlist.length, 0);
  assert.equal(repeat.watched[0].lastChecked, now.getTime());
  const later = applyReturningShowCheck([], repeat.watched, repeat.watched[0], details('2026-06-19'), now);
  assert.equal(later.returned?.returnedFor, '2026-06-19');
});

test('manual list moves preserve return state even when details lacks it', () => {
  const playlist = toggleWatchlistInLibrary([], [played], details());
  assert.equal(playlist.watchlist[0].returnedFor, day);
  const history = toggleWatchedInLibrary(playlist.watchlist, [], details());
  assert.equal(history.watched[0].returnedFor, day);
});

test('return checks respect the seven-day window, ended/canceled status, missing and invalid dates', () => {
  for (const date of ['2026-06-11', '2026-06-20', '2026-02-30', '']) {
    assert.equal(applyReturningShowCheck([], [show], show, details(date), now).returned, undefined);
  }
  for (const status of ['Ended', 'Canceled']) {
    assert.equal(applyReturningShowCheck([], [show], show, { ...details(), status }, now).returned, undefined);
  }
  assert.equal(applyReturningShowCheck([], [show], show, details('2026-06-12'), now).returned?.returnedFor, '2026-06-12');
});

test('in-flight checks cannot resurrect removed, moved, or re-played items or duplicate returns', () => {
  assert.equal(applyReturningShowCheck([], [], show, details(), now).returned, undefined);
  assert.equal(applyReturningShowCheck([returned], [], show, details(), now).returned, undefined);
  assert.equal(applyReturningShowCheck([], [played], show, details(), now).returned, undefined);
  const reAdded = { ...show, date_added: now.toISOString() };
  assert.equal(applyReturningShowCheck([], [reAdded], show, details(), now).returned, undefined);
});

test('return markers round-trip through Gist/JSON backups and older libraries remain valid', () => {
  const payload = JSON.parse(JSON.stringify(buildGistPayload([], [played])));
  assert.equal(payload.version, 6);
  assert.equal(validateLibraryPayload(payload).success, true);
  assert.equal(fromGistItem(payload.watched[0]).returnedFor, day);
  for (const version of [1, 2, 3, 4, 5]) {
    assert.equal(validateLibraryPayload({ ...buildGistPayload([], [show]), version }).success, true);
  }
  for (const returnedFor of ['bad', '2026-02-30', '2026-06-15T00:00:00Z', null, 123]) {
    assert.equal(validateLibraryPayload({ ...payload, watched: [{ ...payload.watched[0], returnedFor }] }).success, false);
  }
  assert.equal(validateLibraryPayload({ ...payload, watched: [{ ...payload.watched[0], media_type: 'movie' }] }).success, false);
});

test('Gist rejects stale automatic returns after another device played, moved, removed, or returned a show', () => {
  const baseline = buildGistPayload([], [show]);
  const pending = buildGistPayload([returned], []);
  for (const remote of [buildGistPayload([], [played]), buildGistPayload([returned], []),
    buildGistPayload([], []), buildGistPayload([{ ...show, date_added: now.toISOString() }], [])]) {
    const merged = mergeGistChanges(remote, baseline, pending);
    assert.deepEqual(merged.watchlist, remote.watchlist);
    assert.deepEqual(merged.watched, remote.watched);
  }
  const accepted = mergeGistChanges(baseline, baseline, pending);
  assert.equal(accepted.watchlist[0].returnedFor, day);
  assert.equal(accepted.watched.length, 0);
});

test('return markers merge independently of ratings, pins, favorites, and manual moves', () => {
  const baseline = buildGistPayload([], [show]);
  const remote = buildGistPayload([], [played]);
  const local = buildGistPayload([], [{ ...show, rating: 5 }]);
  const merged = mergeGistChanges(remote, baseline, local);
  assert.equal(merged.watched[0].returnedFor, day);
  assert.equal(merged.watched[0].rating, 5);
  const manual = mergeGistChanges(remote, baseline, buildGistPayload([show], []));
  assert.equal(manual.watchlist[0].returnedFor, day);
  const newer = { ...played, returnedFor: '2026-06-19' };
  assert.equal(mergeGistChanges(buildGistPayload([], [newer]), remote,
    buildGistPayload([], [{ ...played, title: 'Updated' }])).watched[0].returnedFor, '2026-06-19');
});

test('store return check persists through played state and a Gist sync/rehydration', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const nextDay = new Date();
  nextDay.setDate(nextDay.getDate() + 2);
  const airDate = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
  let remote = buildGistPayload([], [show]);
  globalThis.fetch = async (input, init) => {
    if (String(input).includes('api.github.com')) {
      if (init?.method === 'PATCH') remote = JSON.parse(JSON.parse(init.body as string).files['void-data.json'].content);
      return new Response(JSON.stringify({ files: { 'void-data.json': { content: JSON.stringify(remote) } } }));
    }
    return new Response(JSON.stringify(details(airDate)));
  };
  useStore.setState({ apiKey: 'test', watchlist: [], watched: [show], gistId: '', gistToken: '', githubLogin: '' });
  const migrated = await useStore.getState().processTVMigrations();
  assert.equal(migrated.length, 1);
  assert.equal(migrated[0].returnedFor, airDate);
  await useStore.getState().toggleWatched(details(airDate));
  assert.equal(useStore.getState().watched[0].returnedFor, airDate);
  useStore.getState().setGithubConnection('return-test', 'token', 'user');
  await useStore.getState().syncToGist();
  assert.equal(remote.watched[0].returnedFor, airDate);
  // Simulate cached metadata missing the synced marker; hydration must restore it.
  useStore.setState({ watched: useStore.getState().watched.map((item) => ({ ...item, returnedFor: undefined })) });
  await useStore.getState().syncFromGist();
  assert.equal(useStore.getState().watched[0].returnedFor, airDate);
  useStore.setState({ watched: useStore.getState().watched.map((item) => ({ ...item, lastChecked: 0 })) });
  assert.deepEqual(await useStore.getState().processTVMigrations(), []);
  assert.equal(useStore.getState().watched.length, 1);
  useStore.setState({ gistId: '', gistToken: '', githubLogin: '', watchlist: [], watched: [] });
});
