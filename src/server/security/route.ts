import "server-only";
import { NextResponse } from "next/server";
import { AuthError } from "../auth/guards";
import { log } from "./logger";
import { isSameOrigin } from "./request";

export function jsonError(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Route-handler wrapper: optional same-origin enforcement, typed auth errors, no stack traces. */
export function handler<C>(name: string, fn: (req: Request, ctx: C) => Promise<Response>, opts: { mutation?: boolean } = {}) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      if (opts.mutation && !isSameOrigin(req.headers)) return jsonError(403, "Cross-site request blocked");
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof AuthError) return jsonError(err.code === "UNAUTHENTICATED" ? 401 : 403, err.message);
      log.error(`route.${name}`, err);
      return jsonError(500, "Something went wrong. Please try again.");
    }
  };
}
