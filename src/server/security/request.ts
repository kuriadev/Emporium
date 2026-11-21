import "server-only";
import { headers } from "next/headers";

export class ForbiddenOriginError extends Error {
  constructor() {
    super("Cross-site request blocked");
  }
}

function allowedHosts(h: Headers): Set<string> {
  const set = new Set<string>();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) set.add(host.toLowerCase());
  if (process.env.APP_ORIGIN) {
    try {
      set.add(new URL(process.env.APP_ORIGIN).host.toLowerCase());
    } catch {
      /* ignore malformed APP_ORIGIN */
    }
  }
  return set;
}

/** Verifies Origin (or Referer fallback) matches this host. Server Actions get this from Next too; route handlers rely on it. */
export function isSameOrigin(h: Headers): boolean {
  const source = h.get("origin") ?? h.get("referer");
  if (!source) return false;
  try {
    return allowedHosts(h).has(new URL(source).host.toLowerCase());
  } catch {
    return false;
  }
}

export async function assertSameOrigin(): Promise<void> {
  if (!isSameOrigin(await headers())) throw new ForbiddenOriginError();
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim().slice(0, 64);
}

export async function userAgent(): Promise<string> {
  return ((await headers()).get("user-agent") ?? "").slice(0, 256);
}
