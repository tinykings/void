import assert from 'node:assert/strict';
import test from 'node:test';
import { formatGamePrice, getSteamAppId } from './ggDeals';

test('getSteamAppId prefers normalized ID and parses Steam URLs as fallback', () => {
  assert.equal(getSteamAppId({ id: 72, source: 'igdb', steam_app_id: 620, source_url: undefined }), 620);
  assert.equal(getSteamAppId({ id: 620, source: 'steam', source_url: undefined }), 620);
  assert.equal(getSteamAppId({ id: 1, source_url: 'https://store.steampowered.com/app/1245620/ELDEN_RING/' }), 1245620);
  assert.equal(getSteamAppId({ id: 1, source_url: 'https://www.igdb.com/games/elden-ring' }), undefined);
});

test('formatGamePrice formats returned currency and rejects invalid amounts', () => {
  assert.equal(formatGamePrice({ currency: 'USD', lowestCurrent: { amount: '12.49', source: 'retail' } }), '$12.49');
  assert.equal(formatGamePrice({ currency: 'USD', lowestCurrent: { amount: 'invalid', source: 'keyshop' } }), '');
});
