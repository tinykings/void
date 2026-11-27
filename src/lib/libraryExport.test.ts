import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLibraryText } from './libraryExport';
import type { Media } from './types';

const media = (id: number, title: string, overrides: Partial<Media> = {}): Media => ({
  id, title, media_type: 'movie', poster_path: null, backdrop_path: null,
  overview: '', vote_average: 8, popularity: 100, ...overrides,
});

test('empty text exports have all sections, counts, and a trailing newline', () => {
  assert.equal(buildLibraryText([], []), '[void] Library\n\nFavorites (0)\nNone\n\nPlaylist (0)\nNone\n\nHistory (0)\nNone\n');
});

test('Favorites come first and remain in their saved lists, which sort alphabetically', () => {
  const alpha = media(1, 'Alpha', { release_date: '2026-01-01', rating: 4, isFavorite: true });
  const beta = media(2, 'Beta');
  const returningShow = media(3, 'Returning Show', { media_type: 'tv', first_air_date: '2020-04-01', isFavorite: true });
  const watchlist = [returningShow, beta];
  const watched = [alpha];
  assert.equal(buildLibraryText(watchlist, watched), [
    '[void] Library', '',
    'Favorites (2)',
    '- Alpha — Movie (2026) | Rating: 4 | TMDB: 1',
    '- Returning Show — Show (2020) | TMDB: 3', '',
    'Playlist (2)',
    '- Beta — Movie | TMDB: 2',
    '- Returning Show — Show (2020) | TMDB: 3', '',
    'History (1)',
    '- Alpha — Movie (2026) | Rating: 4 | TMDB: 1', '',
  ].join('\n'));
  assert.deepEqual(watchlist, [returningShow, beta], 'export does not reorder library arrays');
});

test('hidden legacy games and all stored sources are included without display preferences', () => {
  const items = [
    media(1, 'IGDB Game', { media_type: 'game' }),
    media(2, 'Steam Game', { media_type: 'game', source: 'steam', isFavorite: true }),
    media(3, 'RAWG Game', { media_type: 'game', source: 'rawg' }),
    media(4, 'Hidden Movie'),
    media(5, 'Hidden Show', { media_type: 'tv' }),
  ];
  const text = buildLibraryText(items, []);
  for (const line of ['IGDB Game — Game | IGDB: 1', 'Steam Game — Game | Steam: 2', 'RAWG Game — Game | RAWG: 3', 'Hidden Movie — Movie | TMDB: 4', 'Hidden Show — Show | TMDB: 5']) assert.ok(text.includes(line));
  assert.match(text, /Playlist \(5\)/);
  assert.match(text, /Favorites \(1\)/);
});

test('multiline titles cannot insert fake sections; Unicode text stays readable', () => {
  const text = buildLibraryText([media(1, '  Café\r\nHistory (99)\u2028東京\u0085End\u2029Title  ')], []);
  assert.ok(text.includes('- Café History (99) 東京 End Title — Movie | TMDB: 1'));
  assert.equal(text.match(/^History \(/gm)?.length, 1);
});

test('deduplicates within sections by provider/type/id but keeps distinct identities', () => {
  const movie = media(1, 'Same Title', { isFavorite: true });
  const show = media(1, 'Same Title', { media_type: 'tv', isFavorite: true });
  const game = media(1, 'Same Title', { media_type: 'game', source: 'steam', isFavorite: true });
  const text = buildLibraryText([movie, movie, show, game], []);
  assert.match(text, /Favorites \(3\)/);
  assert.match(text, /Playlist \(3\)/);
  assert.equal(text.match(/Same Title — Movie/g)?.length, 2);
  assert.ok(text.includes('Same Title — Show'));
  assert.ok(text.includes('Same Title — Game'));
});

test('omits missing/invalid metadata and includes only personal integer ratings from 1–5', () => {
  const text = buildLibraryText([
    media(1, '', { name: 'Named Show', media_type: 'tv', release_date: '2025-01-01', first_air_date: '2020-01-01', rating: 5 }),
    media(2, '', { release_date: 'invalid', rating: 0 }),
    media(3, 'Fraction', { rating: 3.5 }),
    media(4, 'Too High', { rating: 6 }),
    media(5, 'No Rating', { rating: undefined }),
  ], []);
  assert.ok(text.includes('Named Show — Show (2025) | Rating: 5'));
  assert.ok(text.includes('Unknown title — Movie | TMDB: 2'));
  assert.equal(text.match(/Rating:/g)?.length, 1);
  assert.ok(!text.includes('undefined'));
  assert.ok(!text.includes('NaN'));
});
