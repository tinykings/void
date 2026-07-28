import assert from 'node:assert/strict';
import test from 'node:test';
import { getSteamAppId, normalizeGgDealsGamePrice } from './index';

test('getSteamAppId reads IGDB Steam external ID and website fallback', () => {
  assert.equal(getSteamAppId({ id: 1, external_games: [{ category: 1, uid: '1245620' }] }), 1245620);
  assert.equal(getSteamAppId({ id: 2, websites: [{ url: 'https://store.steampowered.com/app/620/Portal_2/' }] }), 620);
  assert.equal(getSteamAppId({ id: 3, websites: [{ url: 'https://example.com/app/620' }] }), undefined);
});

test('normalizeGgDealsGamePrice chooses lowest current price and labels keyshops', () => {
  const price = normalizeGgDealsGamePrice(620, {
    title: 'Portal 2',
    url: 'https://gg.deals/game/portal-2/',
    prices: {
      currentRetail: '9.99',
      currentKeyshops: '4.20',
      historicalRetail: '0.99',
      historicalKeyshops: '1.25',
      currency: 'USD',
    },
  });

  assert.deepEqual(price?.lowestCurrent, { amount: '4.20', source: 'keyshop' });
  assert.equal(price?.currency, 'USD');
});

test('normalizeGgDealsGamePrice handles missing games and prefers retail on ties', () => {
  assert.equal(normalizeGgDealsGamePrice(1, null), null);
  const price = normalizeGgDealsGamePrice(1, {
    title: 'Game',
    url: 'https://gg.deals/game/game/',
    prices: { currentRetail: '5.00', currentKeyshops: '5.00', currency: 'USD' },
  });
  assert.deepEqual(price?.lowestCurrent, { amount: '5.00', source: 'retail' });
});
