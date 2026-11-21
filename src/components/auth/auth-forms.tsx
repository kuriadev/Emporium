"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Eye, EyeOff, ShieldAlert, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, type Path } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { BotGuard } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { loginSchema, passwordRules, registerSchema } from "@/lib/validations/auth";
import { loginAction, registerAction } from "@/server/actions/auth";
import { useCart } from "@/stores/cart";

export interface SandboxAccount {
  label: string;
  hint: string;
  email: string;
  password: string;
}

function PasswordToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-label={shown ? "Hide password" : "Show password"} aria-pressed={shown} className="-mr-2 grid size-tap shrink-0 place-items-center rounded-full text-muted transition hover:text-fg">
      {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </button>
  );
}

function useCountdown() {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until]);
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  return { left, start: (seconds: number) => setUntil(Date.now() + seconds * 1000) };
}

type LoginIn = z.input<typeof loginSchema>;

export function LoginForm({ scope, next, sandbox }: { scope: "customer" | "admin"; next?: string; sandbox: SandboxAccount[] }) {
  const router = useRouter();
  const hydrate = useCart((s) => s.hydrate);
  const [shown, setShown] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState(false);
  const { left, start } = useCountdown();
  const first = sandbox[0];
  const form = useForm<LoginIn>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: first?.email ?? "", password: first?.password ?? "", next },
    mode: "onTouched",
  });
  const { errors, isSubmitting, submitCount, dirtyFields } = form.formState;
  const email = form.watch("email");

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={form.handleSubmit(async (data) => {
        setError(undefined);
        const res = await loginAction({ ...data, next }, scope);
        if (!res.ok) {
          setError(res.error);
          if (res.retryAfter) start(res.retryAfter);
          if (res.fieldErrors?.password) form.setError("password", { message: res.fieldErrors.password });
          if (res.fieldErrors?.email) form.setError("email", { message: res.fieldErrors.email });
          return;
        }
        setSuccess(true);
        if (scope === "customer") void hydrate();
        router.replace(res.data.redirectTo);
        router.refresh();
      })}
    >
      {sandbox.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs text-subtle">
            <Sparkles className="size-3.5" aria-hidden /> Sandbox accounts · tap to fill
          </p>
          <div className="flex flex-wrap gap-2">
            {sandbox.map((acc) => {
              const on = email === acc.email;
              return (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => {
                    form.setValue("email", acc.email, { shouldDirty: true, shouldValidate: true });
                    form.setValue("password", acc.password, { shouldDirty: true, shouldValidate: true });
                    setError(undefined);
                  }}
                  className={cn("min-h-tap rounded-md border px-3 py-1.5 text-left text-xs transition active:scale-95", on ? "border-accent bg-accent/10 text-fg" : "border-line text-muted hover:border-line-strong hover:text-fg")}
                >
                  <span className="block text-sm">{acc.label}</span>
                  <span className="block text-subtle">{acc.hint}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <Field label="Email" type="email" autoComplete="username" inputMode="email" required {...form.register("email")} error={errors.email?.message} valid={!!dirtyFields.email && !errors.email} shakeKey={submitCount} />
      <Field
        label="Password"
        type={shown ? "text" : "password"}
        autoComplete="current-password"
        required
        {...form.register("password")}
        error={errors.password?.message}
        shakeKey={submitCount}
        suffix={<PasswordToggle shown={shown} onToggle={() => setShown((s) => !s)} />}
      />
      <AnimatePresence>
        {error && (
          <motion.p key={error + submitCount} initial={{ opacity: 0, x: 0 }} animate={{ opacity: 1, x: [0, -8, 7, -4, 0] }} exit={{ opacity: 0 }} role="alert" className="flex items-start gap-2 rounded-md border border-danger/50 bg-danger/10 p-3 text-sm text-danger">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {error}
              {left > 0 && <span className="block text-xs">You can try again in {left}s.</span>}
            </span>
          </motion.p>
        )}
      </AnimatePresence>
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting} success={success} disabled={left > 0}>
        {left > 0 ? `Locked · ${left}s` : scope === "admin" ? "Enter staff portal" : "Sign in"} {left === 0 && <ArrowRight className="size-4" aria-hidden />}
      </Button>
    </form>
  );
}

type RegisterIn = z.input<typeof registerSchema>;
type RegisterOut = z.output<typeof registerSchema>;

export function RegisterForm({ next, sandbox }: { next?: string; sandbox: boolean }) {
  const router = useRouter();
  const hydrate = useCart((s) => s.hydrate);
  const [shown, setShown] = useState(false);
  const [error, setError] = useState<string>();
  const form = useForm<RegisterIn, unknown, RegisterOut>({
    resolver: zodResolver(registerSchema),
    defaultValues: sandbox
      ? { name: "Sam Dela Cruz", email: "sam.delacruz@example.com", password: "Sunset#Manila2026", confirmPassword: "Sunset#Manila2026", acceptTerms: false as unknown as true, next, company: "", startedAt: 0 }
      : { name: "", email: "", password: "", confirmPassword: "", acceptTerms: false as unknown as true, next, company: "", startedAt: 0 },
    mode: "onTouched",
  });
  useEffect(() => form.setValue("startedAt", Date.now()), [form]);
  const { errors, isSubmitting, submitCount, dirtyFields } = form.formState;
  const password = form.watch("password") ?? "";

  return (
    <form
      noValidate
      className="relative space-y-5"
      onSubmit={form.handleSubmit(async (data) => {
        setError(undefined);
        const res = await registerAction({ ...data, next });
        if (!res.ok) {
          setError(res.error);
          for (const [k, v] of Object.entries(res.fieldErrors ?? {})) form.setError(k as Path<RegisterIn>, { message: v });
          return;
        }
        toast.success(res.message ?? "Account created");
        void hydrate();
        router.replace(res.data.redirectTo);
        router.refresh();
      })}
    >
      <BotGuard register={(name) => form.register(name)} />
      <Field label="Full name" autoComplete="name" required {...form.register("name")} error={errors.name?.message} valid={!!dirtyFields.name && !errors.name} shakeKey={submitCount} />
      <Field label="Email" type="email" autoComplete="email" inputMode="email" required {...form.register("email")} error={errors.email?.message} valid={!!dirtyFields.email && !errors.email} shakeKey={submitCount} />
      <div className="space-y-3">
        <Field
          label="Password"
          type={shown ? "text" : "password"}
          autoComplete="new-password"
          required
          {...form.register("password")}
          error={errors.password?.message}
          valid={!!dirtyFields.password && !errors.password && passwordRules.every((r) => r.test(password))}
          shakeKey={submitCount}
          suffix={<PasswordToggle shown={shown} onToggle={() => setShown((s) => !s)} />}
        />
        <ul className="grid grid-cols-1 gap-1 text-xs xs:grid-cols-2" aria-label="Password requirements">
          {passwordRules.map((r) => {
            const met = r.test(password);
            return (
              <li key={r.id} className={cn("flex items-center gap-1.5 transition-colors", met ? "text-success" : "text-subtle")}>
                <motion.span key={String(met)} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 700, damping: 16 }}>
                  {met ? <Check className="size-3.5" aria-hidden /> : <X className="size-3.5" aria-hidden />}
                </motion.span>
                {r.label}
                <span className="sr-only">{met ? "(met)" : "(not met)"}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <Field label="Confirm password" type={shown ? "text" : "password"} autoComplete="new-password" required {...form.register("confirmPassword")} error={errors.confirmPassword?.message} valid={!!dirtyFields.confirmPassword && !errors.confirmPassword && password === form.watch("confirmPassword")} shakeKey={submitCount} />
      <label className={cn("flex min-h-tap cursor-pointer items-start gap-3 text-sm", errors.acceptTerms ? "text-danger" : "text-muted")}>
        <input type="checkbox" {...form.register("acceptTerms")} className="mt-1 size-4 accent-[var(--color-accent)]" aria-invalid={!!errors.acceptTerms} />
        <span>
          I agree to the <span className="text-fg underline underline-offset-4">Terms</span> and <span className="text-fg underline underline-offset-4">Privacy Policy</span>.
          {errors.acceptTerms && <span className="block text-xs">{errors.acceptTerms.message}</span>}
        </span>
      </label>
      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1, x: [0, -8, 7, -4, 0] }} exit={{ opacity: 0 }} role="alert" className="rounded-md border border-danger/50 bg-danger/10 p-3 text-sm text-danger">
            {error}
          </motion.p>
        )}
      </AnimatePresence>
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
        Create account <ArrowRight className="size-4" aria-hidden />
      </Button>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="text-accent underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
