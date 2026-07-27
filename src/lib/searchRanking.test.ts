import assert from 'node:assert/strict';
import test from 'node:test';
import { rankSearchResults } from './searchRanking';
import type { Media } from './types';

const media = (id: number, title: string, popularity = 0): Media => ({
  id,
  title,
  poster_path: null,
  backdrop_path: null,
  overview: '',
  vote_average: 0,
  popularity,
  media_type: 'movie',
});

test('rankSearchResults prioritizes exact, prefix, then contained matches', () => {
  const results = rankSearchResults([
    media(1, 'The Batman'),
    media(2, 'Batman Begins'),
    media(3, 'Batman'),
  ], 'Batman');

  assert.deepEqual(results.map((item) => item.id), [3, 2, 1]);
});

test('rankSearchResults normalizes punctuation and accents and uses popularity as tie-breaker', () => {
  const results = rankSearchResults([
    media(1, 'Pokémon', 10),
    media(2, 'Pokemon', 20),
  ], 'pokemon');

  assert.deepEqual(results.map((item) => item.id), [2, 1]);
});
