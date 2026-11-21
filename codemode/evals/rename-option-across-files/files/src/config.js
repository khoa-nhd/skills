export const defaults = { maxRetries: 3, maxRetriesPerHost: 2, timeoutMs: 1000 };

export function fromEnv(env) {
  return { ...defaults, maxRetries: Number(env.MAX_RETRIES ?? defaults.maxRetries) };
}
