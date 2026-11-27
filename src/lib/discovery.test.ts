import assert from 'node:assert/strict';
import test from 'node:test';
import { discoveryDay, mixDiscovery, upcomingReleaseDays, upcomingWindow } from './discovery';
import { getUpcomingMedia } from './tmdb';
import type { Media } from './types';

const now = new Date(2026, 11, 20, 23, 45);
const media = (id: number, type: 'movie' | 'tv' = 'movie', date?: string): Media => ({
  id, title: `Title ${id}`, media_type: type, poster_path: null, backdrop_path: null,
  overview: '', vote_average: 8, popularity: 1000 - id,
  ...(type === 'movie' ? { release_date: date } : { first_air_date: date }),
});

test('upcoming dates span tomorrow through day 30 across year and month boundaries', () => {
  assert.equal(discoveryDay(now), '2026-12-20');
  assert.deepEqual(upcomingWindow(now), { from: '2026-12-21', to: '2027-01-19' });
  assert.deepEqual(upcomingWindow(new Date(2028, 1, 20)), { from: '2028-02-21', to: '2028-03-21' });
  assert.equal(upcomingReleaseDays(media(1, 'movie', '2026-12-21'), now), 1);
  assert.equal(upcomingReleaseDays(media(1, 'tv', '2027-01-19'), now), 30);
  for (const date of [undefined, '', '2026-12-19', '2026-12-20', '2027-01-20', '2026-02-30', '2027-01-01T00:00:00Z', 'invalid']) {
    assert.equal(upcomingReleaseDays(media(1, 'movie', date), now), null);
  }
});

test('countdowns count calendar days across DST and ignore returning episodes and legacy games', () => {
  const originalTZ = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';
  try {
    assert.equal(upcomingReleaseDays(media(1, 'movie', '2026-03-09'), new Date(2026, 2, 7, 23)), 2);
    assert.equal(upcomingReleaseDays(media(1, 'tv', '2026-11-02'), new Date(2026, 9, 31, 23)), 2);
    const returning = { ...media(1, 'tv', '2020-01-01'), next_episode_to_air: { air_date: '2026-12-21' } } as Media;
    assert.equal(upcomingReleaseDays(returning, now), null);
    assert.equal(upcomingReleaseDays({ ...media(1, 'movie', '2026-12-21'), media_type: 'game' }, now), null);
  } finally {
    if (originalTZ === undefined) delete process.env.TZ;
    else process.env.TZ = originalTZ;
  }
});

test('discovery preserves trending order, inserts after every fourth title, and appends alternating leftovers', () => {
  const trending = Array.from({ length: 8 }, (_, i) => media(i + 1));
  const movies = Array.from({ length: 8 }, (_, i) => media(101 + i, 'movie', '2026-12-25'));
  const shows = Array.from({ length: 8 }, (_, i) => media(201 + i, 'tv', '2026-12-26'));
  const result = mixDiscovery(trending, movies, shows, now);
  assert.deepEqual(result.map((item) => item.id), [1, 2, 3, 4, 101, 5, 6, 7, 8, 201, 102, 202, 103, 203, 104, 204, 105, 205, 106, 206]);
  assert.equal(movies.length, 8);
  assert.equal(trending.length, 8);
});

test('discovery deduplicates before capping and excludes missing/out-of-window dates and disabled types', () => {
  const movie = media(1, 'movie', '2026-12-21');
  const show = media(1, 'tv', '2026-12-22');
  const moreMovies = Array.from({ length: 8 }, (_, i) => media(10 + i, 'movie', '2026-12-23'));
  const movies = [movie, movie, media(2), media(3, 'movie', '2026-12-20'), media(4, 'movie', '2027-01-20'), ...moreMovies];
  const result = mixDiscovery([movie, movie, { ...movie, id: 99, media_type: 'game' }], movies, [show, show], now);
  assert.deepEqual(result.map((item) => `${item.media_type}-${item.id}`), ['movie-1', 'movie-10', 'tv-1', 'movie-11', 'movie-12', 'movie-13', 'movie-14', 'movie-15']);
  assert.deepEqual(mixDiscovery([], [], [], now), []);
  assert.deepEqual(mixDiscovery([], moreMovies, [], now), moreMovies.slice(0, 6));
});

test('upcoming API requests use local premiere-date windows, popularity order, and normalized types', async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: URL; options?: RequestInit }> = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url: new URL(String(url)), options });
    return new Response(JSON.stringify({ results: [{ id: 42, release_date: '2026-12-25', first_air_date: '2026-12-25' }] }));
  };
  try {
    const controller = new AbortController();
    for (const type of ['movie', 'tv'] as const) {
      const result = await getUpcomingMedia(type, 'test-token', controller.signal, now);
      assert.equal(result[0].media_type, type);
      assert.equal(result[0].source, 'tmdb');
      const { url, options } = requests.at(-1)!;
      const field = type === 'movie' ? 'primary_release_date' : 'first_air_date';
      assert.equal(url.pathname, `/3/discover/${type}`);
      assert.equal(url.searchParams.get(`${field}.gte`), '2026-12-21');
      assert.equal(url.searchParams.get(`${field}.lte`), '2027-01-19');
      assert.equal(url.searchParams.get('sort_by'), 'popularity.desc');
      assert.equal(url.searchParams.get('include_adult'), 'false');
      assert.equal(options?.signal, controller.signal);
      assert.equal((options?.headers as Record<string, string>).Authorization, 'Bearer test-token');
    }
  } finally { globalThis.fetch = originalFetch; }
});
