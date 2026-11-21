export function describe(settings) {
  return ['maxRetries', 'timeoutMs'].map((key) => `${key}=${settings[key]}`).join(' ');
}
