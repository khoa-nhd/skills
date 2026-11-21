import { log } from './log.js';

export const DEFAULT_PORT = 3000;

export function address(port = DEFAULT_PORT) {
  log(`listening on ${port}`);
  return `http://localhost:${port}`;
}
