import { z } from "zod";
import { sanitizeText } from "../security/sanitize";

export const cleanText = (min: number, max: number, label: string) =>
  z
    .string({ error: `${label} is required` })
    .transform((v) => sanitizeText(v))
    .pipe(
      z
        .string()
        .min(min, min <= 1 ? `${label} is required` : `${label} must be at least ${min} characters`)
        .max(max, `${label} must be at most ${max} characters`),
    );

export const cleanMultiline = (min: number, max: number, label: string) =>
  z
    .string()
    .transform((v) => sanitizeText(v, { multiline: true }))
    .pipe(z.string().min(min, `${label} must be at least ${min} characters`).max(max, `${label} must be at most ${max} characters`));

export const emailSchema = z
  .string({ error: "Email is required" })
  .trim()
  .toLowerCase()
  .max(254, "Email is too long")
  .pipe(z.email("Enter a valid email like alex.rivera@example.com"));

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number, e.g. +63 917 555 0142");

/** Hidden honeypot field + render timestamp; bots fill everything and submit instantly. */
export const botGuardSchema = z.object({
  company: z.string().max(0, "Bot check failed").optional().default(""),
  startedAt: z.coerce.number().int().positive(),
});

export const MIN_HUMAN_FORM_MS = 1500;

export function looksAutomated(guard: { company?: string; startedAt: number }, now = Date.now()): boolean {
  return (guard.company ?? "") !== "" || now - guard.startedAt < MIN_HUMAN_FORM_MS || guard.startedAt > now + 60_000;
}
