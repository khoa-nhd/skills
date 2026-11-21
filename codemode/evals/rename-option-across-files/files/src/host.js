export function hostBudget({ maxRetriesPerHost }, used) {
  return Math.max(0, maxRetriesPerHost - used);
}
