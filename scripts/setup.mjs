// Creates .env.local with a fresh random SESSION_SECRET (never overwrites an existing file).
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

const file = new URL("../.env.local", import.meta.url);
if (existsSync(file)) {
  console.log(".env.local already exists, leaving it untouched.");
} else {
  writeFileSync(file, `SESSION_SECRET=${randomBytes(48).toString("base64url")}\nEMPORIUM_SANDBOX=1\n`, { mode: 0o600 });
  console.log("Created .env.local with a random SESSION_SECRET.");
}
