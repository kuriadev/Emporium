import { maskEmail } from "@/lib/security/sanitize";

const SECRET_KEYS = /pass(word)?|token|secret|authorization|cookie|card|cvc|cvv|otp|session/i;
const EMAIL_KEYS = /email/i;
const PHONE_KEYS = /phone|mobile/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[depth]";
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => {
        if (SECRET_KEYS.test(k)) return [k, "[redacted]"];
        if (EMAIL_KEYS.test(k) && typeof v === "string") return [k, maskEmail(v)];
        if (PHONE_KEYS.test(k) && typeof v === "string") return [k, v.replace(/\d(?=\d{2})/g, "•")];
        return [k, redact(v, depth + 1)];
      }),
    );
  }
  return value;
}

type Level = "info" | "warn" | "error";

function write(level: Level, event: string, meta?: Record<string, unknown>) {
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...(meta ? (redact(meta) as object) : {}) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const log = {
  info: (event: string, meta?: Record<string, unknown>) => write("info", event, meta),
  warn: (event: string, meta?: Record<string, unknown>) => write("warn", event, meta),
  error: (event: string, err: unknown, meta?: Record<string, unknown>) =>
    write("error", event, { ...meta, error: err instanceof Error ? { name: err.name, message: err.message } : String(err) }),
};
