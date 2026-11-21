import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { getDb, schema } from "../db";
import { userAgent } from "../security/request";
import { ADMIN_SESSION_TTL_MS, CUSTOMER_SESSION_TTL_MS, SESSION_COOKIE, signSessionToken, verifySessionToken } from "./token";

export const GUEST_COOKIE = "em_guest";
const secure = process.env.NODE_ENV === "production";

export type SessionUser = Pick<
  schema.User,
  "id" | "email" | "name" | "phone" | "role" | "adminRole" | "status" | "createdAt"
>;

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const claims = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!claims) return null;

  const db = getDb();
  const row = db
    .select({ session: schema.sessions, user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, claims.sid), gt(schema.sessions.expiresAt, new Date())))
    .get();

  if (!row || row.user.id !== claims.uid || row.user.status !== "active") return null;
  if (row.session.sessionVersion !== row.user.sessionVersion || row.user.role !== claims.role) return null;

  const { id, email, name, phone, role, adminRole, status, createdAt } = row.user;
  return { id, email, name, phone, role, adminRole, status, createdAt };
});

/** Issues a fresh session id (rotation) and revokes the previous one presented by this browser. */
export async function createSession(user: Pick<schema.User, "id" | "role" | "adminRole" | "sessionVersion">): Promise<void> {
  const store = await cookies();
  const db = getDb();
  const previous = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (previous) db.delete(schema.sessions).where(eq(schema.sessions.id, previous.sid)).run();

  const ttl = user.role === "admin" ? ADMIN_SESSION_TTL_MS : CUSTOMER_SESSION_TTL_MS;
  const sid = randomBytes(32).toString("base64url");
  db.insert(schema.sessions)
    .values({ id: sid, userId: user.id, sessionVersion: user.sessionVersion, userAgent: await userAgent(), expiresAt: new Date(Date.now() + ttl) })
    .run();

  const token = await signSessionToken({ sid, uid: user.id, role: user.role, ar: user.adminRole ?? null }, ttl);
  store.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: Math.floor(ttl / 1000), priority: "high" });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const claims = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (claims) getDb().delete(schema.sessions).where(eq(schema.sessions.id, claims.sid)).run();
  store.delete(SESSION_COOKIE);
}

/** Invalidates every session for a user (password change, role change, suspension). */
export function revokeAllSessions(userId: string): void {
  const db = getDb();
  db.transaction((tx) => {
    const user = tx.select({ v: schema.users.sessionVersion }).from(schema.users).where(eq(schema.users.id, userId)).get();
    if (!user) return;
    tx.update(schema.users).set({ sessionVersion: user.v + 1, updatedAt: new Date() }).where(eq(schema.users.id, userId)).run();
    tx.delete(schema.sessions).where(eq(schema.sessions.userId, userId)).run();
  });
}

export async function readOwnerKey(): Promise<string | null> {
  const user = await getCurrentUser();
  if (user) return `u:${user.id}`;
  const guest = (await cookies()).get(GUEST_COOKIE)?.value;
  return guest && /^[A-Za-z0-9_-]{20,64}$/.test(guest) ? `g:${guest}` : null;
}

/** Only callable from Server Actions / Route Handlers (sets a cookie for first-time guests). */
export async function ensureOwnerKey(): Promise<string> {
  const existing = await readOwnerKey();
  if (existing) return existing;
  const guest = randomUUID().replace(/-/g, "") + randomBytes(6).toString("base64url");
  (await cookies()).set(GUEST_COOKIE, guest, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 60 * 60 * 24 * 30 });
  return `g:${guest}`;
}

export async function readGuestKey(): Promise<string | null> {
  const guest = (await cookies()).get(GUEST_COOKIE)?.value;
  return guest && /^[A-Za-z0-9_-]{20,64}$/.test(guest) ? `g:${guest}` : null;
}
