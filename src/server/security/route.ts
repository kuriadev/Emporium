import "server-only";
import { NextResponse } from "next/server";
import { CSRF_COOKIE, CSRF_HEADER, csrfMatches } from "@/lib/security/csrf";
import { AuthError } from "../auth/guards";
import { log } from "./logger";
import { isSameOrigin } from "./request";

export function jsonError(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
}

function cookieValue(req: Request, name: string): string | undefined {
  const raw = req.headers.get("cookie") ?? "";
  for (const part of raw.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq) === name) return decodeURIComponent(part.slice(eq + 1));
  }
  return undefined;
}

/** Route-handler wrapper: same-origin + double-submit CSRF on mutations, typed auth errors, no stack traces. */
export function handler<C>(name: string, fn: (req: Request, ctx: C) => Promise<Response>, opts: { mutation?: boolean } = {}) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      if (opts.mutation && (!isSameOrigin(req.headers) || !csrfMatches(cookieValue(req, CSRF_COOKIE), req.headers.get(CSRF_HEADER)))) {
        return jsonError(403, "This request was blocked for your security. Refresh the page and try again.");
      }
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof AuthError) return jsonError(err.code === "UNAUTHENTICATED" ? 401 : 403, err.message);
      log.error(`route.${name}`, err);
      return jsonError(500, "Something went wrong. Please try again.");
    }
  };
}
