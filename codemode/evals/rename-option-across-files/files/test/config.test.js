import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fromEnv, hostBudget } from '../src/index.js';

test('reads the environment', () => {
  assert.equal(fromEnv({ MAX_RETRIES: '7' }).maxRetries, 7);
});

test('host budget is separate', () => {
  assert.equal(hostBudget({ maxRetriesPerHost: 2 }, 1), 1);
});
