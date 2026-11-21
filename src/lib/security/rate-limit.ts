export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  hit(key: string): RateLimitResult;
  peek(key: string): RateLimitResult;
  reset(key: string): void;
}

/**
 * Sliding-window-log limiter. In-memory, so it is per-process: swap the Map for Redis
 * (ZADD/ZREMRANGEBYSCORE) when running more than one instance.
 */
export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now): RateLimiter {
  const hits = new Map<string, number[]>();

  const prune = (key: string): number[] => {
    const cutoff = now() - windowMs;
    const list = (hits.get(key) ?? []).filter((t) => t > cutoff);
    if (list.length) hits.set(key, list);
    else hits.delete(key);
    return list;
  };

  const result = (list: number[]): RateLimitResult => {
    const ok = list.length < limit;
    const oldest = list[0] ?? now();
    return {
      ok,
      remaining: Math.max(0, limit - list.length),
      retryAfterSeconds: ok ? 0 : Math.max(1, Math.ceil((oldest + windowMs - now()) / 1000)),
    };
  };

  if (hits.size > 50_000) hits.clear();

  return {
    hit(key) {
      const list = prune(key);
      const before = result(list);
      if (!before.ok) return before;
      list.push(now());
      hits.set(key, list);
      return { ...result(list), ok: true };
    },
    peek: (key) => result(prune(key)),
    reset: (key) => void hits.delete(key),
  };
}
