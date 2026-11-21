export function queueJob(job, options) {
  const { maxRetries = 1 } = options;
  return { ...job, attemptsLeft: maxRetries };
}
