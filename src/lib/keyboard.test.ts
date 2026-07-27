import assert from 'node:assert/strict';
import test from 'node:test';
import { getDetailsKeyboardAction, triggerDetailsAction } from './keyboard';

test('maps details shortcuts without regard to letter case', () => {
  assert.equal(getDetailsKeyboardAction('w'), 'watchlist');
  assert.equal(getDetailsKeyboardAction('W'), 'watchlist');
  assert.equal(getDetailsKeyboardAction('e'), 'watched');
  assert.equal(getDetailsKeyboardAction('E'), 'watched');
  assert.equal(getDetailsKeyboardAction('x'), null);
});

test('routes a shortcut through the matching details action control', () => {
  let receivedSelector = '';
  let clickCount = 0;
  const root = {
    querySelector(selector: string) {
      receivedSelector = selector;
      return { click: () => { clickCount += 1; } };
    },
  };

  assert.equal(triggerDetailsAction('watchlist', root), true);
  assert.equal(receivedSelector, '[data-details-action="watchlist"]');
  assert.equal(clickCount, 1);
});

test('does not trigger a missing or disabled details action', () => {
  assert.equal(triggerDetailsAction('watched', { querySelector: () => null }), false);
  assert.equal(triggerDetailsAction('watched', {
    querySelector: () => ({ disabled: true, click: () => assert.fail('disabled control was clicked') }),
  }), false);
});
