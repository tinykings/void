import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMetadataRefresher, DAY_MS, isMetadataStale, metadataMaxAge, mergeMediaMetadata,
  METADATA_BATCH_LIMIT, METADATA_RETRY_DELAY_MS, needsReturningShowCheck,
  type MetadataEntry, type MetadataSnapshot,
} from './metadataRefresh';
import type { Media } from './types';
import { buildGistPayload } from './gist';
import { getPosterCandidates } from './media';
import { useStore } from '../store/useStore';

const time = new Date(2026, 5, 12, 12).getTime();
const movie = (id: number, extra: Partial<Media> = {}): Media => ({
  id, title: `Movie ${id}`, media_type: 'movie', source: 'tmdb',
  poster_path: '/poster.jpg', backdrop_path: null, overview: 'Cached', popularity: 1, vote_average: 7,
  date_added: '2026-01-01T00:00:00.000Z', ...extra,
});
const entry = (item: Media, list: MetadataEntry['list'] = 'watchlist'): MetadataEntry => ({ item, list });

test('daily ongoing Playlist shows; weekly movies, History, and ended/canceled shows', () => {
  const ongoing = movie(1, { media_type: 'tv', status: 'Returning Series', metadataFetchedAt: time });
  assert.equal(metadataMaxAge(entry(ongoing)), DAY_MS);
  assert.equal(isMetadataStale(entry(ongoing), time + DAY_MS - 1), false);
  assert.equal(isMetadataStale(entry(ongoing), time + DAY_MS), true);
  for (const candidate of [entry(movie(2, { metadataFetchedAt: time })), entry(ongoing, 'watched'),
    entry({ ...ongoing, status: 'Ended' }), entry({ ...ongoing, status: 'Canceled' })]) {
    assert.equal(metadataMaxAge(candidate), 7 * DAY_MS);
    assert.equal(isMetadataStale(candidate, time + 7 * DAY_MS - 1), false);
    assert.equal(isMetadataStale(candidate, time + 7 * DAY_MS), true);
  }
  assert.equal(metadataMaxAge(entry({ ...ongoing, status: undefined })), DAY_MS);
});

test('missing, invalid, and future cache ages refresh once; lastChecked is not metadata age', () => {
  for (const metadataFetchedAt of [undefined, 0, -1, NaN, Infinity, time + 1]) {
    assert.equal(isMetadataStale(entry(movie(1, { metadataFetchedAt, lastChecked: time })), time), true);
  }
  assert.equal(isMetadataStale(entry(movie(1, { media_type: 'game' })), time), false);
  const show = movie(1, { media_type: 'tv', status: 'Returning Series', metadataFetchedAt: time, lastChecked: time - DAY_MS });
  assert.equal(isMetadataStale(entry(show, 'watched'), time), false);
  assert.equal(needsReturningShowCheck(entry(show, 'watched'), time), true);
  assert.equal(needsReturningShowCheck(entry({ ...show, lastChecked: time }, 'watched'), time), false);
  assert.equal(needsReturningShowCheck(entry({ ...show, status: 'Ended' }, 'watched'), time), false);
});

test('metadata merging preserves library actions and independent return-check age', () => {
  const saved = movie(1, { isFavorite: true, rating: 5, pinnedAt: '2026-06-01T00:00:00Z', returnedFor: '2026-06-02', lastChecked: 123 });
  const merged = mergeMediaMetadata(saved, movie(9, { title: 'Updated', isFavorite: false, rating: 1, date_added: 'old', lastChecked: 999 }), time);
  assert.equal(merged.title, 'Updated');
  for (const key of ['id', 'source', 'media_type', 'isFavorite', 'rating', 'pinnedAt', 'returnedFor', 'lastChecked', 'date_added'] as const) {
    assert.equal(merged[key], saved[key]);
  }
  assert.equal(merged.metadataFetchedAt, time);
  assert.equal(JSON.stringify(buildGistPayload([merged], [])).includes('metadataFetchedAt'), false);
});

const harness = (watchlist: Media[], watched: Media[] = []) => {
  let clock = time;
  let online = true;
  let state: MetadataSnapshot = { apiKey: 'test', watchlist, watched };
  const calls: number[] = [];
  const checks: number[] = [];
  const errors: unknown[] = [];
  let fetchDetails: (item: Media) => Promise<Media> = async (item) => ({ ...item, overview: 'Updated', poster_path: null });
  const refresh = createMetadataRefresher({
    snapshot: () => state,
    canRefresh: () => online,
    now: () => clock,
    pauseBetweenPosterBatches: async () => {},
    fetchDetails: async (item) => { calls.push(item.id); return fetchDetails(item); },
    apply: (checked, details, fetchedAt, checkReturn) => {
      if (checkReturn) checks.push(checked.item.id);
      const update = (items: Media[]) => items.map((item) => item.id === checked.item.id
        ? { ...mergeMediaMetadata(item, details, fetchedAt), ...(checkReturn ? { lastChecked: clock } : {}) } : item);
      state = { ...state, watchlist: update(state.watchlist), watched: update(state.watched) };
      return undefined;
    },
    onError: (error) => errors.push(error),
  });
  return { refresh, calls, checks, errors, state: () => state,
    setState: (next: MetadataSnapshot) => { state = next; },
    advance: (milliseconds: number) => { clock += milliseconds; },
    setOnline: (value: boolean) => { online = value; },
    setFetch: (value: typeof fetchDetails) => { fetchDetails = value; },
  };
};

test('one sequential flight shared by simultaneous triggers, with no missing-poster refetch loop', async () => {
  const h = harness([movie(1), movie(2)]);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  h.setFetch(async (item) => { await gate; return { ...item, overview: 'Updated', poster_path: null }; });
  const first = h.refresh();
  assert.equal(h.refresh(), first);
  assert.deepEqual(h.calls, [1]);
  release();
  await first;
  assert.deepEqual(h.calls, [1, 2]);
  await h.refresh();
  assert.deepEqual(h.calls, [1, 2]);
  assert.equal(h.state().watchlist[0].metadataFetchedAt, time);
});

test('History return checks reuse recent details rather than duplicate a details fetch', async () => {
  const h = harness([], [movie(1, { media_type: 'tv', status: 'Returning Series', metadataFetchedAt: time - 1000 })]);
  await h.refresh();
  assert.deepEqual(h.calls, []);
  assert.deepEqual(h.checks, [1]);
  assert.equal(h.state().watched[0].metadataFetchedAt, time - 1000);
  await h.refresh();
  assert.deepEqual(h.checks, [1]);
  h.advance(DAY_MS);
  await h.refresh();
  assert.deepEqual(h.calls, [1]);
});

test('offline/no API key makes no requests; reconnect processes due titles but never games', async () => {
  const h = harness([movie(1), movie(2, { media_type: 'game' })]);
  h.setOnline(false);
  await h.refresh();
  assert.deepEqual(h.calls, []);
  h.setOnline(true);
  h.setState({ ...h.state(), apiKey: '' });
  await h.refresh();
  assert.deepEqual(h.calls, []);
  h.setState({ ...h.state(), apiKey: 'test' });
  await h.refresh();
  assert.deepEqual(h.calls, [1]);
});

test('failures preserve cache age and back off; rate limiting pauses the entire queue', async () => {
  const h = harness([movie(1), movie(2)]);
  h.setFetch(async (item) => { if (item.id === 1) throw new Error('HTTP 503'); return { ...item, overview: 'Updated', poster_path: null }; });
  await h.refresh();
  assert.equal(h.state().watchlist[0].metadataFetchedAt, undefined);
  assert.equal(h.state().watchlist[0].overview, 'Cached');
  assert.equal(h.state().watchlist[1].metadataFetchedAt, time);
  await h.refresh();
  assert.deepEqual(h.calls, [1, 2]);
  h.advance(METADATA_RETRY_DELAY_MS);
  h.setFetch(async () => { throw new Error('TMDB API error: 429 Too Many Requests'); });
  await h.refresh();
  h.setState({ ...h.state(), watchlist: [...h.state().watchlist, movie(3)] });
  await h.refresh();
  assert.deepEqual(h.calls, [1, 2, 1]);
  h.advance(METADATA_RETRY_DELAY_MS);
  h.setFetch(async (item) => ({ ...item, overview: 'Updated', poster_path: null }));
  await h.refresh();
  assert.deepEqual(h.calls, [1, 2, 1, 1, 3]);
});

test('invalid metadata responses do not mark the cache fresh or overwrite a title', async () => {
  const h = harness([movie(1)]);
  h.setFetch(async () => movie(99));
  await h.refresh();
  assert.equal(h.state().watchlist[0].metadataFetchedAt, undefined);
  assert.equal(h.state().watchlist[0].overview, 'Cached');
  assert.equal(h.errors.length, 1);
  await h.refresh();
  assert.deepEqual(h.calls, [1]);
});

test('bounded batches prioritize Playlist, leaving the remaining titles for the next pass', async () => {
  const h = harness(Array.from({ length: METADATA_BATCH_LIMIT }, (_, index) => movie(index + 1)), [movie(99)]);
  await h.refresh();
  assert.equal(h.calls.length, METADATA_BATCH_LIMIT);
  assert.equal(h.calls.includes(99), false);
  await h.refresh();
  assert.equal(h.calls.at(-1), 99);
});

test('artwork backfills blanks before routine checks and continues past one batch', async () => {
  const blank = Array.from({ length: METADATA_BATCH_LIMIT + 5 }, (_, index) => movie(index + 2, { poster_path: null }));
  const h = harness([movie(1), ...blank.slice(0, 20)], blank.slice(20));
  h.setFetch(async (item) => ({ ...item, poster_path: item.id === 2 ? null : `/poster-${item.id}.jpg` }));

  await h.refresh();
  assert.deepEqual(h.calls, [...blank.map((item) => item.id), 1]);
  assert.equal(h.state().watchlist[1].poster_path, null);
  assert.ok(h.state().watched.every((item) => !!item.poster_path));
  await h.refresh();
  assert.equal(h.calls.length, blank.length + 1, 'an actual no-art response does not loop');
});

test('a response without artwork does not remove an existing poster or backdrop', () => {
  const original = movie(1, { backdrop_path: '/old-backdrop.jpg' });
  const merged = mergeMediaMetadata(original, { poster_path: null, backdrop_path: null }, time);
  assert.equal(merged.poster_path, original.poster_path);
  assert.equal(merged.backdrop_path, original.backdrop_path);
});

test('poster candidates try backdrop and alternate CDN sizes without repeating external URLs', () => {
  const build = (path: string, size: string) => `${size}${path}`;
  assert.deepEqual(getPosterCandidates('/poster.jpg', '/back.jpg', build),
    ['w342/poster.jpg', 'w342/back.jpg', 'w185/poster.jpg', 'w185/back.jpg']);
  assert.deepEqual(getPosterCandidates('/poster.jpg', '/poster.jpg', build), ['w342/poster.jpg', 'w185/poster.jpg']);
  assert.deepEqual(getPosterCandidates('https://example.com/poster.jpg', null, build), ['https://example.com/poster.jpg']);
});

test('queue rechecks library after each request, skipping titles removed before their turn', async () => {
  const h = harness([movie(1), movie(2)]);
  h.setFetch(async (item) => {
    h.setState({ ...h.state(), watchlist: [h.state().watchlist[0], movie(3)] });
    return { ...item, overview: 'Updated', poster_path: null };
  });
  await h.refresh();
  assert.deepEqual(h.calls, [1, 3]);
});

test('store refresh preserves mid-flight actions, newer details, and removals', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    useStore.setState({ watchlist: [], watched: [], gistId: '', gistToken: '', githubLogin: '' });
  });
  let resolve!: (value: Response) => void;
  let requests = 0;
  globalThis.fetch = async () => { requests++; return new Promise<Response>((done) => { resolve = done; }); };
  const saved = movie(801);
  useStore.setState({ apiKey: 'test', watchlist: [saved], watched: [], gistId: '', gistToken: '', githubLogin: '' });
  const task = useStore.getState().refreshLibraryMetadata();
  const updated = { ...saved, isFavorite: true, rating: 5, pinnedAt: '2026-06-01T00:00:00Z' };
  useStore.setState({ watchlist: [updated] });
  resolve(new Response(JSON.stringify(movie(801, { overview: 'Fetched', isFavorite: false, rating: 1 }))));
  await task;
  const refreshed = useStore.getState().watchlist[0];
  assert.equal(refreshed.overview, 'Fetched');
  assert.equal(refreshed.isFavorite, true);
  assert.equal(refreshed.rating, 5);
  assert.equal(refreshed.pinnedAt, updated.pinnedAt);
  assert.ok(refreshed.metadataFetchedAt);
  await useStore.getState().refreshLibraryMetadata();
  assert.equal(requests, 1);

  useStore.setState({ watchlist: [movie(802)] });
  const race = useStore.getState().refreshLibraryMetadata();
  useStore.getState().updateMediaMetadata(802, 'movie', { overview: 'Newer detail screen', metadataFetchedAt: Date.now() });
  resolve(new Response(JSON.stringify(movie(802, { overview: 'Older background response' }))));
  await race;
  assert.equal(useStore.getState().watchlist[0].overview, 'Newer detail screen');

  useStore.setState({ watchlist: [movie(803)] });
  const removed = useStore.getState().refreshLibraryMetadata();
  useStore.setState({ watchlist: [] });
  resolve(new Response(JSON.stringify(movie(803))));
  await removed;
  assert.deepEqual(useStore.getState().watchlist, []);
});

test('Gist reads preserve local cache ages without rehydrating every title; metadata stays device-local', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    useStore.setState({ watchlist: [], watched: [], gistId: '', gistToken: '', githubLogin: '' });
  });
  const fresh = movie(901, { metadataFetchedAt: Date.now(), overview: 'Fresh local metadata', title: 'Fresh title', release_date: '2026-12-15' });
  const cachedBlank = movie(903, { poster_path: null, metadataFetchedAt: Date.now() });
  let remote = buildGistPayload([{ ...fresh, title: 'Old remote title', release_date: '2025-01-01' },
    movie(902), movie(903, { poster_path: '/remote-poster.jpg' })], []);
  let metadataRequests = 0;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('api.github.com')) {
      if (init?.method === 'PATCH') remote = JSON.parse(JSON.parse(init.body as string).files['void-data.json'].content);
      return new Response(JSON.stringify({ files: { 'void-data.json': { content: JSON.stringify(remote) } } }));
    }
    metadataRequests++;
    return new Response(JSON.stringify(movie(902)));
  };
  useStore.setState({ apiKey: 'test', watchlist: [fresh, cachedBlank], watched: [], gistId: 'metadata-test', gistToken: 'token', githubLogin: 'user' });
  await useStore.getState().syncFromGist();
  await useStore.getState().syncFromGist();
  assert.equal(metadataRequests, 0);
  assert.equal(useStore.getState().watchlist[0].metadataFetchedAt, fresh.metadataFetchedAt);
  assert.equal(useStore.getState().watchlist[0].overview, fresh.overview);
  assert.equal(useStore.getState().watchlist[0].title, fresh.title);
  assert.equal(useStore.getState().watchlist[0].release_date, fresh.release_date);
  assert.equal(useStore.getState().watchlist[2].poster_path, '/remote-poster.jpg');
  await useStore.getState().refreshLibraryMetadata();
  assert.equal(metadataRequests, 1);
  await useStore.getState().syncToGist();
  assert.equal(JSON.stringify(remote).includes('metadataFetchedAt'), false);
});
