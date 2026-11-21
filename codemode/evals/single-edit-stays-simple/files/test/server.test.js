import assert from 'node:assert/strict';
import { test } from 'node:test';
import { address, DEFAULT_PORT } from '../src/server.js';

test('uses the default port', () => {
  assert.equal(address(), `http://localhost:${DEFAULT_PORT}`);
});
