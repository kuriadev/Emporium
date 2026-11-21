import "server-only";
import { createRateLimiter, type RateLimitResult } from "@/lib/security/rate-limit";

const MIN = 60_000;

function build() {
  return {
    login: createRateLimiter(5, 15 * MIN),
    adminLogin: createRateLimiter(3, 15 * MIN),
    loginIp: createRateLimiter(30, 15 * MIN),
    register: createRateLimiter(5, 60 * MIN),
    promo: createRateLimiter(8, 10 * MIN),
    checkout: createRateLimiter(6, 5 * MIN),
    publicForm: createRateLimiter(5, 10 * MIN),
    search: createRateLimiter(120, MIN),
  };
}

const g = globalThis as unknown as { __emporiumLimiters?: ReturnType<typeof build>; __emporiumPromoSeen?: Map<string, Map<string, number>> };
g.__emporiumLimiters ??= build();
g.__emporiumPromoSeen ??= new Map();

export const limiters = g.__emporiumLimiters;

const PROMO_MEMORY_MS = 10 * MIN;

/**
 * Promo brute-force guard that only counts *new* codes: re-quoting the same applied code while
 * the shopper edits quantities is free, but guessing many different codes trips the limiter.
 */
export function promoAttempt(subject: string, codes: readonly string[], now = Date.now()): RateLimitResult {
  const seen = g.__emporiumPromoSeen!;
  const mine = seen.get(subject) ?? new Map<string, number>();
  for (const [code, expires] of mine) if (expires < now) mine.delete(code);
  // Codes already tried recently are free to re-quote, even if the subject is currently throttled.
  let result: RateLimitResult = { ok: true, remaining: limiters.promo.peek(subject).remaining, retryAfterSeconds: 0 };
  for (const code of codes) {
    if (mine.has(code)) continue;
    result = limiters.promo.hit(subject);
    if (!result.ok) break;
    mine.set(code, now + PROMO_MEMORY_MS);
  }
  if (seen.size > 50_000) seen.clear();
  seen.set(subject, mine);
  return result;
}
