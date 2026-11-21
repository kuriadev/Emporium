import { randomBytes, scrypt as scryptCb, scryptSync, timingSafeEqual, type ScryptOptions } from "node:crypto";

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LEN = 64;
const MAX_MEM = 128 * N * R * 2;

function scrypt(password: string, salt: Buffer, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password.normalize("NFKC"), salt, KEY_LEN, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

const encode = (salt: Buffer, key: Buffer) => `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${key.toString("base64url")}`;

export function hashPasswordSync(password: string): string {
  const salt = randomBytes(16);
  return encode(salt, scryptSync(password.normalize("NFKC"), salt, KEY_LEN, { N, r: R, p: P, maxmem: MAX_MEM }));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return encode(salt, await scrypt(password, salt, { N, r: R, p: P, maxmem: MAX_MEM }));
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, saltB64, keyB64] = stored.split("$");
  if (algo !== "scrypt" || !n || !r || !p || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64url");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64url"), {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 128 * Number(n) * Number(r) * 2,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Pre-computed hash used to equalise timing when the account does not exist. */
export const DUMMY_HASH = "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA$" + "A".repeat(86);
