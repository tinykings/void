import { readFile } from 'node:fs/promises';
import { expect, test, type Locator, type Page } from '@playwright/test';

const movie = {
  id: 101,
  title: 'Test Movie',
  media_type: 'movie',
  poster_path: null,
  backdrop_path: null,
  overview: 'Fixture overview',
  vote_average: 8,
  popularity: 100,
  release_date: '2026-01-01',
};

const mockTmdb = async (page: Page) => {
  await page.route('https://api.themoviedb.org/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = {};

    if (path.includes('/search/multi') || path.includes('/trending/')) body = { results: [movie] };
    else if (path === '/3/movie/101') body = { ...movie, videos: { results: [] } };
    else if (path.endsWith('/credits')) body = { id: 101, cast: [{ id: 501, name: 'Test Actor', character: 'Lead', profile_path: null, order: 0 }] };
    else if (path.endsWith('/images')) body = { id: 101, backdrops: [] };
    else if (path.endsWith('/watch/providers')) body = { results: {} };
    else if (path.endsWith('/release_dates')) body = { id: 101, results: [] };
    else if (path.endsWith('/external_ids')) body = { id: 101, imdb_id: null };

    await route.fulfill({ json: body });
  });
};

const seedConnectedLibrary = async (page: Page, library: { watchlist?: object[]; watched?: object[]; filter?: string } = {}) => {
  await page.goto('/favicon.png');
  await page.evaluate(({ seedMovie, library }) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('keyval-store', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('keyval');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const transaction = request.result.transaction('keyval', 'readwrite');
      transaction.objectStore('keyval').put(JSON.stringify({
        state: {
          apiKey: 'e2e-token',
          watchlist: library.watchlist ?? [seedMovie],
          watched: library.watched ?? [],
          playedEpisodes: {},
          gistId: 'e2e-gist',
          gistToken: 'e2e-gist-token',
          githubLogin: 'e2e-user',
          filter: library.filter ?? 'all',
          sort: 'added',
          showWatched: false,
          showFavoritesOnly: false,
          isSearchFocused: false,
        },
        version: 5,
      }), 'void_user_state');
      transaction.oncomplete = () => {
        request.result.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    };
  }), { seedMovie: movie, library });
};

test('search opens details and keyboard shortcut uses history action', async ({ page }) => {
  await seedConnectedLibrary(page);
  await mockTmdb(page);
  await page.route('https://api.github.com/**', (route) => route.fulfill({ status: 503 }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Search', exact: true }).click();

  const searchDialog = page.getByRole('dialog', { name: 'Search' });
  const search = searchDialog.getByPlaceholder('Search movies and shows...');
  await search.fill('Test Movie');
  await searchDialog.getByRole('button', { name: 'Search', exact: true }).click();
  await searchDialog.getByRole('button', { name: 'Test Movie' }).click();

  await expect(page.getByRole('heading', { name: 'Test Movie' })).toBeVisible();
  await page.keyboard.press('e');
  await expect(page.getByRole('button', { name: 'In History' })).toBeVisible();
});

test('mobile search and details use routes without forcing keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedConnectedLibrary(page);
  await mockTmdb(page);
  await page.route('https://api.github.com/**', (route) => route.fulfill({ status: 503 }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Search', exact: true }).click();

  await expect(page).toHaveURL(/\/search\/?$/);
  const search = page.getByPlaceholder('Search movies and shows...');
  await expect(search).not.toBeFocused();
  await search.fill('Test Movie');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: /Open details for Test Movie/ }).click();

  await expect(page).toHaveURL(/\/details\/?\?/);
  await expect(page.getByRole('heading', { name: 'Test Movie' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to collection' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Test Actor/ })).toBeVisible();
});

test('connected library performs initial and manual Gist sync', async ({ page }) => {
  await seedConnectedLibrary(page);
  await mockTmdb(page);
  let gistReads = 0;

  await page.route('https://api.github.com/gists/e2e-gist', async (route) => {
    if (route.request().method() === 'GET') gistReads += 1;
    await route.fulfill({ json: {
      files: {
        'void-data.json': {
          content: JSON.stringify({
            version: 3,
            watchlist: [{ id: 101, title: 'Test Movie', media_type: 'movie', source: 'tmdb', date_added: '2026-01-01T00:00:00.000Z' }],
            watched: [],
            favorites: [],
            playedEpisodes: {},
          }),
        },
      },
    } });
  });

  await page.goto('/');
  await expect.poll(() => gistReads).toBeGreaterThan(0);
  await page.getByRole('button', { name: /Filter:/ }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Sync collection now' }).click();
  await expect.poll(() => gistReads).toBeGreaterThan(1);
});

test('disconnecting GitHub clears persisted connection', async ({ page }) => {
  await seedConnectedLibrary(page);
  await mockTmdb(page);
  await page.route('https://api.github.com/**', (route) => route.fulfill({ status: 503 }));
  await page.goto('/');

  await page.getByRole('button', { name: /Filter:/ }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Disconnect GitHub' }).click();

  await expect(page.getByText('GitHub disconnected from this browser')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect GitHub' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Connect GitHub' })).toBeVisible();
});

test('cached app shell starts offline and keeps local UI available', async ({ page, context }) => {
  await seedConnectedLibrary(page);
  await mockTmdb(page);
  await page.route('https://api.github.com/**', (route) => route.fulfill({ status: 503 }));
  await page.goto('/');
  await expect(page.getByText('Test Movie')).toBeVisible();

  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Test Movie')).toBeVisible();

  await page.goto('/search');
  const offlineSearch = page.getByRole('textbox', { name: 'Search unavailable offline' });
  await expect(offlineSearch).toBeVisible();
  await expect(offlineSearch).toBeDisabled();

  await page.goto('/details?id=101&type=movie&source=tmdb&title=Test+Movie');
  await expect(page.getByRole('heading', { name: 'Test Movie', exact: true })).toBeVisible();
});

// Store Gist writes in memory so these flows exercise real sync/serialization, not GitHub.
const mockLibraryGist = async (page: Page, watchlist: object[], watched: object[] = [], favorites: object[] = []) => {
  let library = { version: 5, watchlist, watched, favorites, playedEpisodes: {} };
  await page.route('https://api.github.com/gists/e2e-gist', async (route) => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON();
      library = JSON.parse(body.files['void-data.json'].content);
    }
    await route.fulfill({ json: { files: { 'void-data.json': { content: JSON.stringify(library) } } } });
  });
  return () => library;
};

const gistMovie = (id: number, title: string) => ({ id, title, media_type: 'movie', source: 'tmdb', date_added: '2026-01-01T00:00:00.000Z' });

test('pin syncs to Gist and survives reload; Show Titles stays local', async ({ page }, testInfo) => {
  await seedConnectedLibrary(page, { watchlist: [movie, { ...movie, id: 102, title: 'Other Movie', date_added: '2026-02-01T00:00:00.000Z' }] });
  await mockTmdb(page);
  const getGist = await mockLibraryGist(page, [gistMovie(101, 'Test Movie'), gistMovie(102, 'Other Movie')]);
  await page.goto('/');
  await page.getByRole('button', { name: /Open details for Test Movie/ }).click();
  await page.getByRole('button', { name: 'Pin to top', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unpin', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => (getGist().watchlist[0] as { pinnedAt?: string }).pinnedAt).toBeTruthy();
  await page.reload();
  await expect(page.getByRole('button', { name: /Open details for/ }).first()).toHaveAccessibleName(/Test Movie/);
  await expect(page.getByLabel('Pinned', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Filter:/ }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByText('Show Titles', { exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Show Titles', exact: true })).toBeChecked();
  // IndexedDB persistence is asynchronous; wait for the transaction before navigating.
  await expect.poll(() => page.evaluate(() => new Promise<boolean>((resolve) => {
    const request = indexedDB.open('keyval-store', 1);
    request.onsuccess = () => {
      const read = request.result.transaction('keyval').objectStore('keyval').get('void_user_state');
      read.onsuccess = () => { resolve(!!JSON.parse(read.result).state.showTitles); request.result.close(); };
    };
  }))).toBe(true);
  await page.reload();
  await expect(page.locator('.type-action').filter({ hasText: /^Test Movie$/ }).last()).toBeVisible();
  await page.getByRole('button', { name: /Filter:/ }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Show Titles', exact: true })).toBeChecked();
  expect(JSON.stringify(getGist())).not.toContain('showTitles');
  await page.locator('section').filter({ has: page.getByRole('checkbox', { name: 'Show Titles', exact: true }) }).screenshot({ path: testInfo.outputPath('display-settings.png') });
  await page.reload();
  await page.getByRole('button', { name: /Open details for Test Movie/ }).click();
  await page.getByRole('button', { name: 'Unpin', exact: true }).click();
  await expect.poll(() => (getGist().watchlist[0] as { pinnedAt?: string }).pinnedAt).toBeUndefined();
  await expect(page.getByRole('button', { name: 'Pin to top', exact: true })).toBeVisible();
});

test('recommendations use favorites, deduplicate results, exclude saved titles, and show source', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedConnectedLibrary(page, { watchlist: [movie], watched: [{ ...movie, id: 103, title: 'Favorite Movie', isFavorite: true }] });
  await mockTmdb(page);
  const favorite = gistMovie(103, 'Favorite Movie');
  await mockLibraryGist(page, [gistMovie(101, 'Test Movie')], [favorite], [favorite]);
  await page.route('https://api.themoviedb.org/3/movie/103/recommendations**', (route) => route.fulfill({ json: { results: [movie, { ...movie, id: 201, title: 'New Recommendation' }, { ...movie, id: 201, title: 'New Recommendation' }] } }));
  await page.goto('/');
  await page.getByRole('button', { name: /Filter:/ }).click();
  await page.getByRole('button', { name: 'Recommendations', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Recommendations', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Open details for New Recommendation/ })).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Open details for Test Movie/ })).toHaveCount(0);
  await expect(page.getByText('Favorite Movie', { exact: true })).toBeVisible();
  await expect(page.getByText('Because you favorited', { exact: false })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('recommendations-mobile.png') });
  await page.getByRole('button', { name: 'Clear Recommendations view' }).click();
  await expect(page.getByRole('button', { name: /Open details for Test Movie/ })).toBeVisible();
});

test('legacy media preferences no longer hide shows; games stay hidden but remain in backups', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('void_enabled_media_types', JSON.stringify({ movie: true, tv: false, game: true })));
  const archived = { id: 620, title: 'Archived Game', media_type: 'game', source: 'igdb', date_added: '2026-01-01T00:00:00.000Z', image: null, isPurchased: true, rating: 5 };
  const favorite = { ...archived, source: 'steam', title: 'Archived Favorite' };
  const savedShow = { ...movie, id: 621, title: 'Previously hidden Show', media_type: 'tv', status: 'Ended', metadataFetchedAt: Date.now() };
  await seedConnectedLibrary(page, { watchlist: [movie, savedShow, archived], watched: [{ ...favorite, isFavorite: true }], filter: 'game' });
  await mockTmdb(page);
  const getGist = await mockLibraryGist(page, [gistMovie(101, 'Test Movie'), { ...gistMovie(621, savedShow.title), media_type: 'tv' }, archived], [favorite], [favorite]);
  const gameRequests: string[] = [];
  page.on('request', (request) => { if (/\/api\/(games|prices)\//.test(request.url())) gameRequests.push(request.url()); });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Open details for Test Movie/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Open details for Previously hidden Show/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Open details for Archived/ })).toHaveCount(0);
  await page.getByRole('button', { name: /Filter:/ }).click();
  await expect(page.getByRole('button', { name: 'Movies', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Shows', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Games', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Deals', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Media types', exact: true })).toHaveCount(0);
  await expect(page.getByRole('switch', { name: /Movies|Shows|Games/ })).toHaveCount(0);
  await expect(page.getByText(/2 previously saved games are hidden, not deleted/)).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON backup', exact: true }).click();
  const download = await downloaded;
  const backup = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(backup.watchlist.find((item: { source?: string }) => item.source === 'igdb')).toEqual(archived);
  expect(backup.watched).toContainEqual(favorite);
  expect(backup.favorites).toContainEqual(favorite);
  await page.getByRole('button', { name: 'Sync collection now', exact: true }).click();
  expect(getGist().watchlist).toContainEqual(archived);
  expect(getGist().favorites).toContainEqual(favorite);
  await page.goto('/details?id=620&type=game&source=igdb&title=Archived+Game');
  await expect(page.getByRole('heading', { name: 'Games are no longer supported' })).toBeVisible();
  expect(gameRequests).toEqual([]);
});

test('unaired episode summaries stay hidden until revealed and can be hidden again', async ({ page }) => {
  const show = { ...movie, id: 301, title: 'Test Show', name: 'Test Show', media_type: 'tv', status: 'Ended' };
  await seedConnectedLibrary(page, { watchlist: [show] });
  await mockTmdb(page);
  await page.route('https://api.github.com/**', (route) => route.fulfill({ status: 503 }));
  await page.route('https://api.themoviedb.org/3/tv/301**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const episodes = [
      { id: 1, episode_number: 1, season_number: 1, name: 'Aired Episode', air_date: '2020-01-01', overview: 'An aired summary.', still_path: null },
      { id: 2, episode_number: 2, season_number: 1, name: 'Future Episode', air_date: '2099-01-01', overview: 'A secret future plot.', still_path: null },
    ];
    return route.fulfill({ json: path.endsWith('/season/1') ? { episodes } : path === '/3/tv/301' ? { ...show, seasons: [{ id: 1, name: 'Season 1', season_number: 1, episode_count: 2 }], videos: { results: [] } } : {} });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Open details for Test Show/ }).click();
  await expect(page.getByText('An aired summary.', { exact: true })).toBeVisible();
  await expect(page.getByText('A secret future plot.', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Reveal spoilers for episode 2' }).click();
  await expect(page.getByText('A secret future plot.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Hide spoilers for episode 2' }).click();
  await expect(page.getByText('A secret future plot.', { exact: true })).toHaveCount(0);
});

const persistedMetadataAge = (page: Page, id: number) => page.evaluate((mediaId) => new Promise<number | undefined>((resolve, reject) => {
  const request = indexedDB.open('keyval-store', 1);
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const read = request.result.transaction('keyval').objectStore('keyval').get('void_user_state');
    read.onsuccess = () => {
      const state = JSON.parse(read.result).state;
      resolve([...state.watchlist, ...state.watched].find((item: { id: number }) => item.id === mediaId)?.metadataFetchedAt);
      request.result.close();
    };
    read.onerror = () => reject(read.error);
  };
}), id);

test('library metadata refreshes by age on launch, foreground, and reconnect without repeated requests', async ({ page, context }) => {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const titles = [
    { ...movie, id: 401, title: 'Ongoing Show', media_type: 'tv', status: 'Returning Series', metadataFetchedAt: now - 2 * day },
    { ...movie, id: 402, title: 'Fresh Movie', metadataFetchedAt: now - day },
    { ...movie, id: 403, title: 'Ended Show', media_type: 'tv', status: 'Ended', metadataFetchedAt: now - day },
  ];
  await seedConnectedLibrary(page, { watchlist: titles.map((item) => ({ ...item, poster_path: '/cached.jpg' })) });
  await page.clock.setFixedTime(new Date(now));
  await page.route('https://api.github.com/**', (route) => route.fulfill({ status: 503 }));
  await page.route('https://image.tmdb.org/**', (route) => route.fulfill({ status: 404 }));
  const requests: Record<number, number> = { 401: 0, 402: 0, 403: 0 };
  await page.route('https://api.themoviedb.org/**', (route) => {
    const id = Number(new URL(route.request().url()).pathname.split('/').at(-1));
    const item = titles.find((candidate) => candidate.id === id);
    if (item) requests[id]++;
    return route.fulfill({ json: item ? { ...item, overview: 'Refreshed', videos: { results: [] } } : {} });
  });
  const foreground = () => page.evaluate(() => {
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.goto('/');
  await expect.poll(() => persistedMetadataAge(page, 401)).toBe(now);
  expect(requests).toEqual({ 401: 1, 402: 0, 403: 0 });
  await page.reload();
  await expect(page.getByRole('button', { name: /Open details for Ongoing Show/ })).toBeVisible();
  await foreground();
  expect(requests).toEqual({ 401: 1, 402: 0, 403: 0 });

  await page.clock.setFixedTime(new Date(now + day));
  await foreground();
  await expect.poll(() => persistedMetadataAge(page, 401)).toBe(now + day);
  expect(requests).toEqual({ 401: 2, 402: 0, 403: 0 });

  await page.clock.setFixedTime(new Date(now + 6 * day));
  await foreground();
  await expect.poll(() => persistedMetadataAge(page, 403)).toBe(now + 6 * day);
  expect(requests).toEqual({ 401: 3, 402: 1, 403: 1 });

  await context.setOffline(true);
  await expect(page.getByText('Offline mode', { exact: true })).toBeVisible();
  await page.clock.setFixedTime(new Date(now + 14 * day));
  await foreground();
  expect(requests).toEqual({ 401: 3, 402: 1, 403: 1 });
  await context.setOffline(false);
  await expect.poll(() => persistedMetadataAge(page, 403)).toBe(now + 14 * day);
  expect(requests).toEqual({ 401: 4, 402: 2, 403: 2 });
});

test('large libraries backfill blank grid posters and retry a failed rendition without opening details', async ({ page }) => {
  const titles = Array.from({ length: 32 }, (_, index) => ({
    ...movie, id: 5000 + index, title: `Imported film ${index + 1}`,
    date_added: '2026-01-01T00:00:00.000Z',
  }));
  await seedConnectedLibrary(page, { watchlist: titles });
  await page.route('https://api.github.com/**', (route) => route.fulfill({ status: 503 }));
  const detailRequests: number[] = [];
  await page.route('https://api.themoviedb.org/**', (route) => {
    const id = Number(new URL(route.request().url()).pathname.split('/').at(-1));
    const item = titles.find((candidate) => candidate.id === id);
    if (item) detailRequests.push(id);
    return route.fulfill({ json: item ? { ...item, poster_path: `/${id}.jpg` } : {} });
  });
  await page.route('https://image.tmdb.org/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/t/p/w342/5031.jpg') return route.fulfill({ status: 404 });
    return route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="18"><rect width="12" height="18" fill="blue"/></svg>',
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Open details for Imported film 24, on playlist', exact: true }).scrollIntoViewIfNeeded();
  const card = page.getByRole('button', { name: /^Open details for Imported film 32\b/ });
  await card.scrollIntoViewIfNeeded();
  const poster = card.locator('img');
  await expect(poster).toHaveAttribute('src', /\/w185\/5031\.jpg$/);
  await expect(poster).toHaveClass(/opacity-100/);
  expect(detailRequests).toHaveLength(titles.length);
});

test('actor filmography retries failures and handles missing biographies', async ({ page }) => {
  await seedConnectedLibrary(page);
  await page.route('https://api.github.com/**', (route) => route.fulfill({ status: 503 }));
  let attempts = 0;
  await page.route('https://api.themoviedb.org/3/person/**', (route) => {
    if (new URL(route.request().url()).pathname.endsWith('/combined_credits')) {
      attempts++;
      return attempts === 1 ? route.fulfill({ status: 503 }) : route.fulfill({ json: { cast: [movie] } });
    }
    return route.fulfill({ json: { id: 501, name: 'Test Actor', biography: '', birthday: null, place_of_birth: null } });
  });
  await page.goto('/person?id=501&name=Test+Actor');
  await expect(page.getByText('No biography available.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'More', exact: true })).toHaveCount(0);
  await expect(page.getByText('Couldn’t load filmography.')).toBeVisible();
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Filmography', exact: true }).getByRole('button', { name: 'Open details for Test Movie', exact: true })).toBeVisible();
  expect(attempts).toBe(2);
});

for (const mobile of [false, true]) {
  test(`actor ${mobile ? 'page' : 'sheet'} expands biographies and curates filmography`, async ({ page }, testInfo) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await seedConnectedLibrary(page);
    await mockTmdb(page);
    await page.route('https://api.github.com/**', (route) => route.fulfill({ status: 503 }));
    await page.route('https://image.tmdb.org/**', (route) => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="342" height="513"><rect width="342" height="513" fill="#123039"/></svg>' }));
    const movies = Array.from({ length: 16 }, (_, index) => ({ ...movie, id: 2000 + index, title: `Film ${index + 1}`, popularity: 100 - index, poster_path: '/movie.jpg' }));
    const shows = Array.from({ length: 16 }, (_, index) => ({ ...movie, id: 3000 + index, media_type: 'tv', title: undefined, name: `Show ${index + 1}`, popularity: 200 - index, poster_path: '/show.jpg' }));
    await page.route('https://api.themoviedb.org/3/movie/2000**', (route) => route.fulfill({ json: new URL(route.request().url()).pathname === '/3/movie/2000' ? { ...movies[0], videos: { results: [] } } : {} }));
    const biography = [
      'Test Actor began performing in a local theatre before building a career in film and television. '.repeat(6),
      'Later roles brought new collaborators and a wide range of characters across independent films and long-running series. '.repeat(6),
      'The full biography includes this final paragraph about recent work and future projects.',
    ].join('\n\n');
    await page.route('https://api.themoviedb.org/3/person/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      const secondActor = path.includes('/502');
      return route.fulfill({ json: path.endsWith('/combined_credits') ? { cast: secondActor ? [] : [
        ...shows, ...movies, movies[0],
        ...[10763, 10764, 10767].map((genre, index) => ({ ...shows[0], id: 4000 + index, name: `Hidden Show ${index}`, genre_ids: [genre], popularity: 9999 })),
      ] } : { id: secondActor ? 502 : 501, name: secondActor ? 'Other Actor' : 'Test Actor', biography: secondActor ? 'A short biography.' : biography, birthday: '1980-01-01', place_of_birth: 'London', profile_path: null } });
    });
    if (mobile) {
      await page.goto('/person?id=501&name=Test+Actor');
    } else {
      await page.goto('/');
      await page.getByRole('button', { name: /Open details for Test Movie/ }).click();
      await page.getByRole('button', { name: /Test Actor/ }).click();
    }
    await expect(page.getByRole('heading', { name: 'Test Actor', exact: true })).toBeVisible();
    const more = page.getByRole('button', { name: 'More', exact: true });
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    const bioId = await more.getAttribute('aria-controls');
    const paragraph = page.locator(`[id="${bioId}"]`);
    const collapsedHeight = await paragraph.evaluate((element) => element.clientHeight);
    await more.click();
    const less = page.getByRole('button', { name: 'Less', exact: true });
    await expect(less).toHaveAttribute('aria-expanded', 'true');
    await expect(paragraph).toContainText('The full biography includes this final paragraph');
    expect(await paragraph.evaluate((element) => element.clientHeight)).toBeGreaterThan(collapsedHeight);
    await less.click();
    await expect(more).toHaveAttribute('aria-expanded', 'false');

    const filmography = page.getByRole('region', { name: 'Filmography', exact: true });
    const titles = filmography.getByRole('button');
    await expect(titles).toHaveCount(30);
    await expect(titles.nth(0)).toHaveAccessibleName('Open details for Film 1');
    await expect(titles.nth(6)).toHaveAccessibleName('Open details for Show 1');
    await expect(titles.nth(12)).toHaveAccessibleName('Open details for Film 7');
    await expect(titles.nth(18)).toHaveAccessibleName('Open details for Show 7');
    await expect(filmography.getByRole('button', { name: /Hidden Show/ })).toHaveCount(0);
    await expect(filmography.getByRole('button', { name: 'Open details for Film 1', exact: true })).toHaveCount(1);
    await page.screenshot({ path: testInfo.outputPath(`actor-${mobile ? 'mobile' : 'desktop'}.png`) });
    if (mobile) {
      await page.goto('/person?id=502&name=Other+Actor');
      await expect(page.getByText('A short biography.', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'More', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Less', exact: true })).toHaveCount(0);
      await expect(page.getByText('No movies or shows found for your enabled media types.')).toBeVisible();
    } else {
      await titles.first().click();
      await expect(page.getByRole('heading', { name: 'Film 1', exact: true })).toBeVisible();
    }
  });
}

const discoveryFixtures = () => {
  const upcomingMovie = { ...movie, id: 601, title: 'Upcoming Film', release_date: '2026-06-06', poster_path: '/film.jpg' };
  const upcomingShow = { ...movie, id: 701, title: undefined, name: 'Upcoming Show', media_type: 'tv', first_air_date: '2026-06-02', poster_path: '/show.jpg' };
  const trending = Array.from({ length: 4 }, (_, index) => ({ ...movie, id: 101 + index, title: index === 0 ? 'Test Movie' : `Trending ${index + 1}` }));
  return { upcomingMovie, upcomingShow, trending };
};

for (const mobile of [false, true]) {
  test(`discovery ${mobile ? 'page' : 'sheet'} mixes upcoming premieres and keeps countdowns out of search`, async ({ page }, testInfo) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await seedConnectedLibrary(page);
    await page.clock.setFixedTime(new Date('2026-06-01T12:00:00Z'));
    await page.route('https://api.github.com/**', (route) => route.fulfill({ status: 503 }));
    await page.route('https://image.tmdb.org/**', (route) => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="342" height="513"><rect width="342" height="513" fill="#123039"/></svg>' }));
    const { upcomingMovie, upcomingShow, trending } = discoveryFixtures();
    let movieDiscoveries = 0;
    await page.route('https://api.themoviedb.org/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      let body: object = {};
      if (path.includes('/trending/')) body = { results: trending };
      else if (path === '/3/discover/movie') {
        movieDiscoveries++;
        body = { results: [upcomingMovie, upcomingMovie, { ...upcomingMovie, id: 101 }, { ...upcomingMovie, id: 602, title: 'Already Out', release_date: '2026-06-01' }, { ...upcomingMovie, id: 603, title: 'Too Far Away', release_date: '2026-07-02' }] };
      } else if (path === '/3/discover/tv') body = { results: [upcomingShow, { ...upcomingShow, id: 702, name: 'Day Thirty Show', first_air_date: '2026-07-01' }] };
      else if (path === '/3/search/multi') body = { results: [upcomingMovie] };
      else if (path === '/3/movie/101') body = { ...movie, videos: { results: [] } };
      return route.fulfill({ json: body });
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    const searchSurface = mobile ? page.locator('.page-surface') : page.getByRole('dialog', { name: 'Search', exact: true });
    await expect(searchSurface.getByRole('heading', { name: 'Trending & upcoming', exact: true })).toBeVisible();
    const cards = searchSurface.getByRole('button', { name: /Open details for/ });
    await expect(cards).toHaveCount(7);
    await expect(cards.nth(4)).toHaveAccessibleName('Open details for Upcoming Film, releases in 5 days');
    await expect(cards.nth(5)).toHaveAccessibleName('Open details for Upcoming Show, releases in 1 day');
    await expect(searchSurface.getByLabel('Releases in 30 days', { exact: true })).toBeVisible();
    await expect(searchSurface.getByRole('button', { name: /Already Out|Too Far Away/ })).toHaveCount(0);
    await searchSurface.getByLabel('Releases in 5 days', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`discovery-${mobile ? 'mobile' : 'desktop'}.png`) });

    await page.getByPlaceholder('Search movies and shows...').fill('Upcoming Film');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Results for “Upcoming Film”', exact: true })).toBeVisible();
    await expect(searchSurface.getByRole('button', { name: 'Open details for Upcoming Film', exact: true })).toBeVisible();
    await expect(searchSurface.getByLabel('Releases in 5 days', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Clear search', exact: true }).click();
    await expect(searchSurface.getByLabel('Releases in 5 days', { exact: true })).toBeVisible();
    expect(movieDiscoveries).toBe(1);
  });
}

test('discovery finishes empty failures, preserves partial results, and retries all sources', async ({ page }) => {
  await seedConnectedLibrary(page);
  await page.clock.setFixedTime(new Date('2026-06-01T12:00:00Z'));
  await page.route('https://api.github.com/**', (route) => route.fulfill({ status: 503 }));
  const { upcomingMovie, upcomingShow, trending } = discoveryFixtures();
  let mode: 'failed' | 'partial' | 'success' = 'failed';
  await page.route('https://api.themoviedb.org/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes('/trending/') || path.includes('/discover/')) {
      if (mode === 'failed' || (mode === 'partial' && path !== '/3/discover/movie')) return route.fulfill({ status: 503 });
      return route.fulfill({ json: { results: path.includes('/trending/') ? trending : path.endsWith('/tv') ? [upcomingShow] : [upcomingMovie] } });
    }
    return route.fulfill({ json: path === '/3/movie/101' ? { ...movie, videos: { results: [] } } : {} });
  });
  await page.goto('/search');
  await expect(page.getByText('Discovery couldn’t load.', { exact: false })).toBeVisible();
  await expect(page.getByText('Nothing trending or upcoming right now', { exact: true })).toBeVisible();
  mode = 'partial';
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('button', { name: /Open details for Upcoming Film/ })).toBeVisible();
  await expect(page.getByText('Some discovery titles couldn’t load.', { exact: false })).toBeVisible();
  mode = 'success';
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('button', { name: /Open details for/ })).toHaveCount(6);
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toHaveCount(0);
});

test('discovery requests both media types despite old preferences and refreshes its date window', async ({ page }) => {
  await seedConnectedLibrary(page);
  await page.evaluate(() => localStorage.setItem('void_enabled_media_types', JSON.stringify({ movie: true, tv: false })));
  await page.clock.setFixedTime(new Date('2026-06-01T12:00:00Z'));
  await page.route('https://api.github.com/**', (route) => route.fulfill({ status: 503 }));
  const { upcomingMovie, upcomingShow, trending } = discoveryFixtures();
  const fromDates: string[] = [];
  let showRequests = 0;
  await page.route('https://api.themoviedb.org/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/3/discover/tv') {
      showRequests++;
      return route.fulfill({ json: { results: [upcomingShow] } });
    }
    if (url.pathname === '/3/discover/movie') {
      const from = url.searchParams.get('primary_release_date.gte')!;
      fromDates.push(from);
      return route.fulfill({ json: { results: [{ ...upcomingMovie, release_date: from }] } });
    }
    return route.fulfill({ json: url.pathname.includes('/trending/') ? { results: trending } : url.pathname === '/3/movie/101' ? { ...movie, videos: { results: [] } } : {} });
  });
  await page.goto('/search');
  await expect(page.getByRole('button', { name: /Open details for/ })).toHaveCount(6);
  await expect(page.getByRole('button', { name: 'Open details for Upcoming Film, releases in 1 day', exact: true })).toBeVisible();
  expect(showRequests).toBe(1);
  expect(fromDates).toEqual(['2026-06-02']);
  await page.clock.setFixedTime(new Date('2026-06-02T12:00:00Z'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => fromDates).toEqual(['2026-06-02', '2026-06-03']);
  await expect(page.getByRole('button', { name: 'Open details for Upcoming Film, releases in 1 day', exact: true })).toBeVisible();
  expect(showRequests).toBe(2);
});

for (const mobile of [false, true]) {
  test(`text export ${mobile ? 'mobile' : 'desktop'} includes hidden records while connected and offline; JSON is retained`, async ({ page, context }, testInfo) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const savedShow = { ...movie, id: 801, title: 'Saved Show', media_type: 'tv', status: 'Ended', release_date: '2020-01-01', date_added: '2026-01-01T00:00:00.000Z', metadataFetchedAt: Date.now() };
    const favorite = { ...movie, title: 'Favorite Film', rating: 4, isFavorite: true, date_added: '2026-01-01T00:00:00.000Z', metadataFetchedAt: Date.now() };
    const archived = { id: 620, title: 'Archived Game', media_type: 'game', source: 'igdb', date_added: '2026-01-01T00:00:00.000Z', image: null, isPurchased: true };
    await seedConnectedLibrary(page, { watchlist: [savedShow, archived], watched: [favorite] });
    await page.evaluate(() => localStorage.setItem('void_enabled_media_types', JSON.stringify({ movie: false, tv: true })));
    await mockTmdb(page);
    const gistFavorite = { ...gistMovie(101, 'Favorite Film'), rating: 4, release_date: '2026-01-01' };
    const getGist = await mockLibraryGist(page, [{ ...gistMovie(801, 'Saved Show'), media_type: 'tv', release_date: '2020-01-01' }, archived], [gistFavorite], [gistFavorite]);
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Open details for Saved Show/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Open details for Favorite Film/ })).toHaveCount(0);
    await page.getByRole('button', { name: /Filter:/ }).click();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByText('@e2e-user', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Media types', exact: true })).toHaveCount(0);
    const exportButton = page.getByRole('button', { name: 'Export library as text', exact: true });
    const textDownload = page.waitForEvent('download');
    await exportButton.click();
    const textFile = await textDownload;
    expect(textFile.suggestedFilename()).toBe('void-library.txt');
    const text = await readFile((await textFile.path())!, 'utf8');
    expect(text).toBe('[void] Library\n\nFavorites (1)\n- Favorite Film — Movie (2026) | Rating: 4 | TMDB: 101\n\nPlaylist (2)\n- Archived Game — Game | IGDB: 620\n- Saved Show — Show (2020) | TMDB: 801\n\nHistory (1)\n- Favorite Film — Movie (2026) | Rating: 4 | TMDB: 101\n');
    expect(text).not.toContain('e2e-gist-token');
    const jsonDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download JSON backup', exact: true }).click();
    const jsonFile = await jsonDownload;
    expect(jsonFile.suggestedFilename()).toBe('void-library-backup.json');
    const json = JSON.parse(await readFile((await jsonFile.path())!, 'utf8'));
    expect(json.watchlist).toContainEqual(archived);
    expect(json.favorites).toEqual([expect.objectContaining(gistFavorite)]);
    expect(getGist().watchlist).toContainEqual(archived);
    await context.setOffline(true);
    await expect(page.getByRole('button', { name: 'Sync collection now', exact: true })).toBeDisabled();
    await expect(exportButton).toBeEnabled();
    const offlineDownload = page.waitForEvent('download');
    await exportButton.click();
    expect(await readFile((await (await offlineDownload).path())!, 'utf8')).toBe(text);
    await page.locator('section').filter({ has: exportButton }).screenshot({ path: testInfo.outputPath(`library-export-${mobile ? 'mobile' : 'desktop'}.png`) });
  });
}

test('export download errors are shown instead of reporting success', async ({ page }) => {
  await seedConnectedLibrary(page);
  await mockTmdb(page);
  await page.route('https://api.github.com/**', (route) => route.fulfill({ status: 503 }));
  await page.goto('/');
  await page.getByRole('button', { name: /Filter:/ }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.evaluate(() => { URL.createObjectURL = () => { throw new Error('Simulated download failure'); }; });
  await page.getByRole('button', { name: 'Export library as text', exact: true }).click();
  await expect(page.getByText('Could not prepare the download. Please try again.', { exact: true })).toBeVisible();
  await expect(page.getByText('Library exported', { exact: true })).toHaveCount(0);
});

const expectPosterIndicator = async (card: Locator, indicator: string, color: string, width = '1px') => {
  const border = card.locator('[data-poster-indicator]');
  await expect(border).toHaveAttribute('data-poster-indicator', indicator);
  await expect(border).toHaveCSS('border-top-color', color);
  // Chromium snaps fractional CSS borders to the device-pixel grid.
  const renderedWidth = width === '2.5px'
    ? await border.evaluate(() => `${Math.floor(2.5 * window.devicePixelRatio) / window.devicePixelRatio}px`)
    : width;
  await expect(border).toHaveCSS('border-top-width', renderedWidth);
};

for (const mobile of [false, true]) {
  test(`poster indicators ${mobile ? 'mobile' : 'desktop'} show favorites in both lists and preserve pin priority`, async ({ page }, testInfo) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const fixedTime = new Date('2026-06-01T12:00:00Z');
    const titles = ['Pinned Title', 'Pinned Favorite', 'Favorite History', 'History Title', 'Upcoming Title', 'Neutral Title'];
    const apiItems = titles.map((title, index) => ({ ...movie, id: 901 + index, title, source: 'tmdb', status: 'Released', poster_path: '/indicator.jpg', release_date: index === 5 ? '2020-01-01' : '2026-06-10' }));
    const playlist = apiItems.slice(0, 2).map((item, index) => ({ ...item, isFavorite: index === 1, pinnedAt: '2026-01-02T00:00:00.000Z', date_added: '2026-01-01T00:00:00.000Z', metadataFetchedAt: fixedTime.getTime() }));
    const history = apiItems.slice(2, 4).map((item, index) => ({ ...item, isFavorite: index === 0, date_added: '2026-01-01T00:00:00.000Z', metadataFetchedAt: fixedTime.getTime() }));
    await seedConnectedLibrary(page, { watchlist: playlist, watched: history });
    await page.clock.setFixedTime(fixedTime);
    const gistItems = apiItems.slice(0, 4).map((item, index) => ({ ...gistMovie(item.id, item.title), release_date: item.release_date, image: item.poster_path, ...(index < 2 ? { pinnedAt: '2026-01-02T00:00:00.000Z' } : {}) }));
    await mockLibraryGist(page, gistItems.slice(0, 2), gistItems.slice(2), [gistItems[1], gistItems[2]]);
    await page.route('https://image.tmdb.org/**', (route) => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="342" height="513"><rect width="342" height="513" fill="#123039"/></svg>' }));
    await page.route('https://api.themoviedb.org/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.includes('/trending/')) return route.fulfill({ json: { results: apiItems.map((item) => ({ ...item, isFavorite: item.id === 903 })) } });
      if (path.includes('/discover/')) return route.fulfill({ json: { results: [] } });
      const item = apiItems.find((candidate) => path === `/3/movie/${candidate.id}`);
      return route.fulfill({ json: item ? { ...item, videos: { results: [] } } : {} });
    });
    const card = (title: string) => page.getByRole('button', { name: new RegExp(`Open details for ${title}`) });
    const closeDetails = () => page.getByRole('button', { name: mobile ? 'Back to collection' : 'Close details', exact: true }).click();
    await page.goto('/');
    await expectPosterIndicator(card('Pinned Title'), 'pinned', 'rgb(34, 211, 238)', '2.5px');
    await expectPosterIndicator(card('Pinned Favorite'), 'pinned', 'rgb(34, 211, 238)', '2.5px');
    const originalSize = await card('Pinned Favorite').boundingBox();
    await card('Pinned Favorite').click();
    await page.getByRole('button', { name: 'Unpin', exact: true }).click();
    await closeDetails();
    await expectPosterIndicator(card('Pinned Favorite'), 'favorite', 'rgb(255, 45, 85)');
    const unpinnedSize = await card('Pinned Favorite').boundingBox();
    expect(unpinnedSize?.width).toBe(originalSize?.width);
    expect(unpinnedSize?.height).toBe(originalSize?.height);
    await page.getByRole('button', { name: 'History', exact: true }).click();
    await expectPosterIndicator(card('Favorite History'), 'favorite', 'rgb(255, 45, 85)');
    await expectPosterIndicator(card('History Title'), 'neutral', 'rgba(255, 255, 255, 0.1)');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    const search = mobile ? page.locator('.page-surface') : page.getByRole('dialog', { name: 'Search', exact: true });
    const searchCard = (title: string) => search.getByRole('button', { name: new RegExp(`Open details for ${title}`) });
    await expectPosterIndicator(searchCard('Pinned Title'), 'playlist', 'rgb(34, 211, 238)');
    await expectPosterIndicator(searchCard('Pinned Favorite'), 'favorite', 'rgb(255, 45, 85)');
    await expectPosterIndicator(searchCard('Favorite History'), 'favorite', 'rgb(255, 45, 85)');
    await expectPosterIndicator(searchCard('History Title'), 'history', 'rgb(52, 211, 153)');
    await expectPosterIndicator(searchCard('Upcoming Title'), 'upcoming', 'rgb(251, 191, 36)', '2px');
    await expectPosterIndicator(searchCard('Neutral Title'), 'neutral', 'rgba(255, 255, 255, 0.1)');
    await expect(searchCard('History Title').getByLabel('Releases in 9 days', { exact: true })).toBeVisible();
    await searchCard('Upcoming Title').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`poster-indicators-${mobile ? 'mobile' : 'desktop'}.png`) });
    await searchCard('Favorite History').click();
    await page.getByRole('button', { name: 'Remove favorite', exact: true }).click();
    await closeDetails();
    // The discovery response deliberately includes a stale favorite flag: library state wins.
    await expectPosterIndicator(searchCard('Favorite History'), 'history', 'rgb(52, 211, 153)');
    await searchCard('Favorite History').click();
    await page.getByRole('button', { name: 'Mark favorite', exact: true }).click();
    await closeDetails();
    await expectPosterIndicator(searchCard('Favorite History'), 'favorite', 'rgb(255, 45, 85)');
    await searchCard('Upcoming Title').click();
    await page.getByRole('button', { name: 'Add to Playlist', exact: true }).click();
    await closeDetails();
    await expectPosterIndicator(searchCard('Upcoming Title'), 'playlist', 'rgb(34, 211, 238)');
    await searchCard('Upcoming Title').click();
    await page.getByRole('button', { name: 'Add to History', exact: true }).click();
    await closeDetails();
    await expectPosterIndicator(searchCard('Upcoming Title'), 'history', 'rgb(52, 211, 153)');
  });
}
