import { defaults } from './config.js';
import { withRetry } from './retry.js';

export function createClient(options = {}) {
  const settings = { ...defaults, ...options };
  return {
    settings,
    send: (fn) => withRetry(fn, { maxRetries: settings.maxRetries }),
  };
}
