import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '../src/index.js';

test('retries up to the limit', async () => {
  let calls = 0;
  const client = createClient({ maxRetries: 2 });
  await assert.rejects(client.send(async () => { calls += 1; throw new Error('no'); }));
  assert.equal(calls, 3);
});
