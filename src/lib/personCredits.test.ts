import assert from 'node:assert/strict';
import test from 'node:test';
import { curatePersonCredits } from './personCredits';
import type { TmdbResult } from './types';

const credit = (id: number, type: 'movie' | 'tv', popularity = 100 - id, genre_ids?: number[]): TmdbResult => ({
  id, media_type: type, title: type === 'movie' ? `Movie ${id}` : undefined,
  name: type === 'tv' ? `Show ${id}` : undefined,
  popularity, genre_ids, vote_average: 8, overview: '', poster_path: null, backdrop_path: null,
});

test('filmography rotates six movies/shows twice, then fills by popularity up to 30', () => {
  const movies = Array.from({ length: 20 }, (_, index) => credit(index + 1, 'movie'));
  const shows = Array.from({ length: 20 }, (_, index) => credit(index + 1, 'tv', 200 - index));
  const input = [...shows, ...movies];
  const original = [...input];
  const result = curatePersonCredits(input);
  assert.equal(result.length, 30);
  assert.deepEqual(result.slice(0, 24).map((item) => item.media_type), [
    ...Array(6).fill('movie'), ...Array(6).fill('tv'),
    ...Array(6).fill('movie'), ...Array(6).fill('tv'),
  ]);
  assert.deepEqual(result.slice(24).map((item) => item.id), [13, 14, 15, 16, 17, 18]);
  assert.ok(result.slice(24).every((item) => item.media_type === 'tv'));
  assert.deepEqual(input, original, 'curation does not mutate API results');
});

test('News, Reality, and Talk are filtered only from shows, not movies', () => {
  const input = [credit(1, 'tv', 10, [10763]), credit(2, 'tv', 10, [10764]), credit(3, 'tv', 10, [18, 10767]), credit(4, 'movie', 10, [10767]), credit(5, 'tv', 10, [18]), credit(6, 'tv')];
  assert.deepEqual(curatePersonCredits(input).map((item) => item.id), [4, 6, 5]);
});

test('deduplicates by type and ID, keeps the most popular entry and posterless titles', () => {
  const result = curatePersonCredits([credit(1, 'movie', 10), credit(1, 'movie', 30), credit(1, 'tv', 20)]);
  assert.equal(result.length, 2);
  assert.equal(result[0].popularity, 30);
  assert.equal(result[0].poster_path, null);
  assert.equal(result[1].media_type, 'tv');
});

test('sparse filmographies retain available titles; small limits and empty results are safe', () => {
  const input = [credit(1, 'movie', 5), credit(2, 'tv', 10), credit(3, 'tv', 20)];
  assert.deepEqual(curatePersonCredits(input).map((item) => item.id), [1, 3, 2]);
  assert.equal(curatePersonCredits(input, 2).length, 2);
  assert.deepEqual(curatePersonCredits(input, 0), []);
  assert.deepEqual(curatePersonCredits([]), []);
  assert.deepEqual(curatePersonCredits([{ ...credit(1, 'movie'), media_type: 'person' } as unknown as TmdbResult]), []);
});
