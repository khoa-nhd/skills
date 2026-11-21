import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describe, legacyLimit, queueJob } from '../src/index.js';

test('queue uses the limit', () => {
  assert.equal(queueJob({ id: 1 }, { maxRetries: 4 }).attemptsLeft, 4);
});

test('legacy limit', () => {
  assert.equal(legacyLimit({ maxRetries: 6 }), 6);
});

test('describe names the option', () => {
  assert.match(describe({ maxRetries: 3, timeoutMs: 5 }), /=3 /);
});
