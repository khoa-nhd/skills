export function legacyLimit(options) {
  const { maxRetries: limit } = options;
  return limit ?? 0;
}
