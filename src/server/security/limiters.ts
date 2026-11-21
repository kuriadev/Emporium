import "server-only";
import { createRateLimiter } from "@/lib/security/rate-limit";

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

const g = globalThis as unknown as { __emporiumLimiters?: ReturnType<typeof build> };
g.__emporiumLimiters ??= build();

export const limiters = g.__emporiumLimiters;
