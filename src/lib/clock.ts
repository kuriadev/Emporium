/**
 * Wall-clock time for server components. They render once per request, so reading the clock is
 * stable for that response; the React purity lint rule is aimed at components that re-render.
 */
export function requestTime(): number {
  return Date.now();
}
