import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import type { ActionFailure, ActionResult } from "@/lib/types";
import { AuthError } from "../auth/guards";
import { AdminError } from "../services/admin";
import { CartError } from "../services/cart";
import { OrderError } from "../services/orders";
import { assertSameOrigin, ForbiddenOriginError } from "../security/request";
import { log } from "../security/logger";

export function zodFailure(error: z.ZodError, message = "Please fix the highlighted fields."): ActionFailure {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
  }
  return { ok: false, error: message, fieldErrors };
}

export const fail = (error: string, extra: Omit<ActionFailure, "ok" | "error"> = {}): ActionFailure => ({ ok: false, error, ...extra });
export const ok = <T>(data: T, message?: string): ActionResult<T> => ({ ok: true, data, message });

/**
 * Wraps every mutation: same-origin check, typed domain errors → user messages,
 * anything unexpected → logged (redacted) + generic message, never a stack trace.
 */
export async function runAction<T>(name: string, fn: () => Promise<ActionResult<T>> | ActionResult<T>): Promise<ActionResult<T>> {
  try {
    await assertSameOrigin();
    return await fn();
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof ForbiddenOriginError) return fail("This request was blocked for your security. Refresh and try again.");
    if (err instanceof AuthError) return fail(err.message);
    if (err instanceof z.ZodError) return zodFailure(err);
    if (err instanceof CartError) return fail(err.message);
    if (err instanceof OrderError || err instanceof AdminError) return fail(err.message, err.field ? { fieldErrors: { [err.field]: err.message } } : {});
    log.error(`action.${name}`, err);
    return fail("Something went wrong on our side. Please try again.");
  }
}
