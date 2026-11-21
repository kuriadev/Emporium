import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

let cached: Uint8Array | null = null;

/**
 * SESSION_SECRET is mandatory in production. In development a random per-checkout secret is
 * generated once into ./data/.session-secret (git-ignored) so nothing is hardcoded in source.
 */
export function getSessionSecret(): Uint8Array {
  if (cached) return cached;
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv && fromEnv.length >= 32) {
    cached = new TextEncoder().encode(fromEnv);
    return cached;
  }
  if (process.env.NODE_ENV === "production" && process.env.EMPORIUM_ALLOW_DEV_SECRET !== "1") {
    throw new Error("SESSION_SECRET must be set to at least 32 characters in production");
  }
  const dir = join(process.cwd(), "data");
  const file = join(dir, ".session-secret");
  if (!existsSync(file)) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, randomBytes(48).toString("base64url"), { mode: 0o600 });
  }
  cached = new TextEncoder().encode(readFileSync(file, "utf8").trim());
  return cached;
}
