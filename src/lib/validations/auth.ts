import { z } from "zod";
import { botGuardSchema, cleanText, emailSchema } from "./common";

const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "123456789", "qwertyuiop", "iloveyou12", "letmein123", "welcome123", "admin12345", "emporium123",
]);

export const passwordRules = [
  { id: "length", label: "At least 10 characters", test: (v: string) => v.length >= 10 },
  { id: "upper", label: "An uppercase letter", test: (v: string) => /[A-Z]/.test(v) },
  { id: "lower", label: "A lowercase letter", test: (v: string) => /[a-z]/.test(v) },
  { id: "digit", label: "A number", test: (v: string) => /\d/.test(v) },
  { id: "symbol", label: "A symbol", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
] as const;

export const strongPassword = z
  .string()
  .max(128, "Password must be at most 128 characters")
  .superRefine((v, ctx) => {
    const failed = passwordRules.filter((r) => !r.test(v));
    if (failed.length) ctx.addIssue({ code: "custom", message: `Password needs: ${failed.map((f) => f.label.toLowerCase()).join(", ")}` });
    if (COMMON_PASSWORDS.has(v.toLowerCase())) ctx.addIssue({ code: "custom", message: "That password is too common" });
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(128),
  next: z.string().max(512).optional(),
});

export const registerSchema = z
  .object({
    name: cleanText(2, 80, "Full name"),
    email: emailSchema,
    password: strongPassword,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, { error: "Please accept the terms to continue" }),
    next: z.string().max(512).optional(),
  })
  .merge(botGuardSchema)
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" })
  .refine((d) => !d.password.toLowerCase().includes(d.email.split("@")[0]!.toLowerCase()), {
    path: ["password"],
    message: "Password must not contain your email name",
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required").max(128),
    newPassword: strongPassword,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" })
  .refine((d) => d.newPassword !== d.currentPassword, { path: ["newPassword"], message: "Choose a different password" });

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Enter your password to confirm").max(128),
  confirm: z.literal("DELETE", { error: 'Type DELETE to confirm' }),
});

export type LoginInput = z.input<typeof loginSchema>;
export type RegisterInput = z.input<typeof registerSchema>;
