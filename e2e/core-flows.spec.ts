import { expect, test, type Page } from '@playwright/test';

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

const seedConnectedLibrary = async (page: Page) => {
  await page.goto('/favicon.png');
  await page.evaluate(({ seedMovie }) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('keyval-store', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('keyval');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const transaction = request.result.transaction('keyval', 'readwrite');
      transaction.objectStore('keyval').put(JSON.stringify({
        state: {
          apiKey: 'e2e-token',
          watchlist: [seedMovie],
          watched: [],
          playedEpisodes: {},
          gistId: 'e2e-gist',
          gistToken: 'e2e-gist-token',
          githubLogin: 'e2e-user',
          filter: 'all',
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
  }), { seedMovie: movie });
};

test('search opens details and keyboard shortcut uses history action', async ({ page }) => {
  await seedConnectedLibrary(page);
  await mockTmdb(page);
  await page.route('https://api.github.com/**', (route) => route.fulfill({ status: 503 }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Search', exact: true }).click();

  const searchDialog = page.getByRole('dialog', { name: 'Search' });
  const search = searchDialog.getByPlaceholder('Search movies, shows, games...');
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
  const search = page.getByPlaceholder('Search movies, shows, games...');
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
  await expect(page.getByRole('textbox', { name: /Search movies, shows, games/ })).toBeVisible();

  await page.goto('/details?id=101&type=movie&source=tmdb&title=Test+Movie');
  await expect(page.getByRole('heading', { name: 'Test Movie', exact: true })).toBeVisible();
});
