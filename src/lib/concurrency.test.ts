import assert from 'node:assert/strict';
import test from 'node:test';
import { mapWithConcurrency } from './concurrency';

test('mapWithConcurrency preserves order and enforces limit', async () => {
  let active = 0;
  let peak = 0;

  const results = await mapWithConcurrency([30, 5, 20, 1], 2, async (delay) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, delay));
    active -= 1;
    return delay * 2;
  });

  assert.deepEqual(results, [60, 10, 40, 2]);
  assert.equal(peak, 2);
});

test('mapWithConcurrency handles empty input and clamps invalid limits', async () => {
  assert.deepEqual(await mapWithConcurrency([], 3, async (item) => item), []);
  assert.deepEqual(await mapWithConcurrency([1, 2], 0, async (item) => item), [1, 2]);
});
