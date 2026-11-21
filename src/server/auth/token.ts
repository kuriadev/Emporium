import { jwtVerify, SignJWT } from "jose";
import { getSessionSecret } from "../security/secret";
import type { AdminRole, UserRole } from "../db/schema";

export const SESSION_COOKIE = "em_session";
export const CUSTOMER_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export interface SessionClaims {
  sid: string;
  uid: string;
  role: UserRole;
  ar: AdminRole | null;
}

export async function signSessionToken(claims: SessionClaims, ttlMs: number): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setIssuer("emporium")
    .setAudience("emporium-web")
    .setExpirationTime(Math.floor((Date.now() + ttlMs) / 1000))
    .sign(getSessionSecret());
}

export async function verifySessionToken(token: string | undefined): Promise<SessionClaims | null> {
  if (!token || token.length > 2048) return null;
  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), {
      algorithms: ["HS256"],
      issuer: "emporium",
      audience: "emporium-web",
    });
    const { sid, uid, role, ar } = payload as Partial<SessionClaims>;
    if (typeof sid !== "string" || typeof uid !== "string" || (role !== "customer" && role !== "admin")) return null;
    return { sid, uid, role, ar: ar ?? null };
  } catch {
    return null;
  }
}
