"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { safeRedirect } from "@/lib/security/redirect";
import type { ActionResult } from "@/lib/types";
import { looksAutomated } from "@/lib/validations/common";
import { changePasswordSchema, deleteAccountSchema, loginSchema, registerSchema } from "@/lib/validations/auth";
import { getDb, schema } from "../db";
import { DUMMY_HASH, hashPassword, verifyPassword } from "../auth/password";
import { createSession, destroySession, getCurrentUser, readGuestKey, revokeAllSessions } from "../auth/session";
import { requireUser } from "../auth/guards";
import { limiters } from "../security/limiters";
import { clientIp } from "../security/request";
import { log } from "../security/logger";
import { mergeOwner } from "../services/cart";
import { writeAudit } from "../services/audit";
import { fail, ok, runAction, zodFailure } from "./run";

type Scope = "customer" | "admin";

export async function loginAction(input: unknown, scope: Scope): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction("login", async () => {
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) return zodFailure(parsed.error);
    const { email, password, next } = parsed.data;

    const ip = await clientIp();
    const limiter = scope === "admin" ? limiters.adminLogin : limiters.login;
    const key = `${scope}:${email}:${ip}`;
    const state = limiter.peek(key);
    const ipState = limiters.loginIp.hit(`${scope}:${ip}`);
    if (!state.ok || !ipState.ok) {
      const retryAfter = Math.max(state.retryAfterSeconds, ipState.retryAfterSeconds);
      return fail(`Too many attempts. Try again in ${Math.ceil(retryAfter / 60)} min.`, { retryAfter });
    }

    const user = getDb().select().from(schema.users).where(eq(schema.users.email, email)).get();
    const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    const roleOk = scope === "admin" ? user?.role === "admin" && !!user.adminRole : user?.role === "customer";

    if (!user || !valid || !roleOk || user.status !== "active") {
      const after = limiter.hit(key);
      log.warn("auth.login_failed", { scope, email, ip, reason: !user ? "unknown" : !valid ? "password" : !roleOk ? "role" : "suspended" });
      if (user && valid && user.status !== "active") return fail("This account is suspended. Contact support@emporium.test.");
      if (scope === "admin" && user && valid && !roleOk) return fail("This portal is for staff accounts only.");
      if (scope === "customer" && user && valid && user.role === "admin") return fail("Staff accounts sign in at /admin/login.");
      return fail(
        after.ok
          ? `Email or password is incorrect. ${after.remaining} attempt${after.remaining === 1 ? "" : "s"} left.`
          : `Too many attempts. Try again in ${Math.ceil(after.retryAfterSeconds / 60)} min.`,
        { retryAfter: after.ok ? undefined : after.retryAfterSeconds, fieldErrors: { password: "Check your password" } },
      );
    }

    limiter.reset(key);
    const guestKey = await readGuestKey();
    await createSession(user);
    if (guestKey && scope === "customer") mergeOwner(guestKey, `u:${user.id}`);
    if (scope === "admin") writeAudit({ actor: { id: user.id, email: user.email }, action: "admin.login", entityType: "user", entityId: user.email, after: { ip } });

    return ok({ redirectTo: safeRedirect(next, scope === "admin" ? "/admin" : "/account", { allowAdmin: scope === "admin" }) });
  });
}

export async function registerAction(input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction("register", async () => {
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) return zodFailure(parsed.error);
    const data = parsed.data;
    if (looksAutomated(data)) return fail("Please take a moment and try again.");

    const ip = await clientIp();
    const rl = limiters.register.hit(ip);
    if (!rl.ok) return fail(`Too many sign-ups from this network. Try again in ${Math.ceil(rl.retryAfterSeconds / 60)} min.`, { retryAfter: rl.retryAfterSeconds });

    const db = getDb();
    if (db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, data.email)).get()) {
      return fail("An account with this email already exists.", { fieldErrors: { email: "Already registered. Try signing in." } });
    }
    const id = randomUUID();
    db.insert(schema.users).values({ id, email: data.email, name: data.name, passwordHash: await hashPassword(data.password) }).run();
    const user = db.select().from(schema.users).where(eq(schema.users.id, id)).get()!;
    const guestKey = await readGuestKey();
    await createSession(user);
    if (guestKey) mergeOwner(guestKey, `u:${id}`);
    return ok({ redirectTo: safeRedirect(data.next, "/account") }, "Welcome to Emporium!");
  });
}

export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();
  await destroySession();
  redirect(user?.role === "admin" ? "/admin/login" : "/");
}

export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  return runAction("change_password", async () => {
    const user = await requireUser();
    const parsed = changePasswordSchema.safeParse(input);
    if (!parsed.success) return zodFailure(parsed.error);
    const db = getDb();
    const row = db.select().from(schema.users).where(eq(schema.users.id, user.id)).get();
    if (!row || !(await verifyPassword(parsed.data.currentPassword, row.passwordHash))) {
      return fail("Current password is incorrect.", { fieldErrors: { currentPassword: "Incorrect password" } });
    }
    db.update(schema.users).set({ passwordHash: await hashPassword(parsed.data.newPassword), updatedAt: new Date() }).where(eq(schema.users.id, user.id)).run();
    revokeAllSessions(user.id);
    const fresh = db.select().from(schema.users).where(eq(schema.users.id, user.id)).get()!;
    await createSession(fresh);
    return ok(null, "Password updated. Other devices were signed out.");
  });
}

export async function deleteAccountAction(input: unknown): Promise<ActionResult> {
  return runAction("delete_account", async () => {
    const user = await requireUser();
    if (user.role === "admin") return fail("Staff accounts are managed by a Super Admin.");
    const parsed = deleteAccountSchema.safeParse(input);
    if (!parsed.success) return zodFailure(parsed.error);
    const db = getDb();
    const row = db.select().from(schema.users).where(eq(schema.users.id, user.id)).get();
    if (!row || !(await verifyPassword(parsed.data.password, row.passwordHash))) return fail("Password is incorrect.", { fieldErrors: { password: "Incorrect password" } });

    db.transaction((tx) => {
      // Orders are retained for tax/accounting but de-identified.
      tx.update(schema.orders)
        .set({
          email: `deleted-${user.id.slice(0, 8)}@redacted.invalid`,
          shippingAddress: { fullName: "Deleted customer", phone: "", line1: "", city: "", province: "", postalCode: "", country: "PH" },
          giftNote: null,
          userId: null,
        })
        .where(eq(schema.orders.userId, user.id))
        .run();
      tx.delete(schema.cartItems).where(eq(schema.cartItems.ownerKey, `u:${user.id}`)).run();
      tx.delete(schema.wishlistItems).where(eq(schema.wishlistItems.ownerKey, `u:${user.id}`)).run();
      tx.delete(schema.users).where(eq(schema.users.id, user.id)).run();
    });
    await destroySession();
    log.info("account.deleted", { userId: user.id });
    return ok(null, "Your account and personal data were deleted.");
  });
}
