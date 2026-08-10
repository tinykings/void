import assert from 'node:assert/strict';
import test from 'node:test';
import { sortGameDeals, type GameDeal } from './gameDeals';
import type { Media } from './types';

const media = (id: number, title: string): Media => ({
  id,
  title,
  poster_path: null,
  backdrop_path: null,
  overview: '',
  vote_average: 0,
  popularity: 0,
  media_type: 'game',
});

const deal = (id: number, title: string, amount: string): GameDeal => ({
  media: media(id, title),
  price: {
    steamAppId: id,
    title,
    url: `https://gg.deals/game/${id}/`,
    currency: 'USD',
    currentRetail: amount,
    currentKeyshops: null,
    historicalRetail: null,
    historicalKeyshops: null,
    lowestCurrent: { amount, source: 'retail' },
  },
});

test('sortGameDeals orders numeric prices lowest first and titles break ties', () => {
  const sorted = sortGameDeals([
    deal(1, 'Zeta', '10.00'),
    deal(2, 'Beta', '2.50'),
    deal(3, 'Alpha', '2.50'),
  ]);

  assert.deepEqual(sorted.map(({ media: item }) => item.title), ['Alpha', 'Beta', 'Zeta']);
});
