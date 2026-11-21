"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { Send } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { LottieSuccess } from "@/components/motion/lottie-success";
import { BotGuard } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { supportSchema } from "@/lib/validations/commerce";
import { supportAction } from "@/server/actions/shop";

type In = z.input<typeof supportSchema>;
type Out = z.output<typeof supportSchema>;

const PRESETS: { label: string; topic: Out["topic"]; message: string }[] = [
  { label: "Where's my order?", topic: "order", message: "Hi! My order EM-2026-0002 shows as shipped but the tracking hasn't moved in two days. Could you check on it?" },
  { label: "Start a return", topic: "returns", message: "Hello, I'd like to return the Blue Jacket from my last order. It runs a little large. What are the next steps?" },
  { label: "Product question", topic: "product", message: "Is the iPhone 13 Pro Max Case compatible with MagSafe chargers and the MagSafe wallet?" },
];

export function SupportForm({ defaults }: { defaults: { name: string; email: string } }) {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string>();
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(supportSchema),
    defaultValues: { name: defaults.name, email: defaults.email, topic: "order", message: PRESETS[0]!.message, company: "", startedAt: 0 },
    mode: "onTouched",
  });
  useEffect(() => form.setValue("startedAt", Date.now()), [form]);
  const { errors, isSubmitting, submitCount, dirtyFields } = form.formState;
  const topic = form.watch("topic");

  if (sent)
    return (
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface/60 p-10 text-center" role="status">
        <LottieSuccess className="size-28" label="Message sent" />
        <h2 className="text-2xl font-light">Message sent</h2>
        <p className="max-w-[28rem] text-muted">Thanks for reaching out. A real person will reply to {form.getValues("email")} within one business day.</p>
        <Button variant="outline" onClick={() => setSent(false)}>
          Send another message
        </Button>
      </motion.div>
    );

  return (
    <form
      noValidate
      className="relative space-y-5 rounded-xl border border-line bg-surface/60 p-5 sm:p-8"
      onSubmit={form.handleSubmit(async (data) => {
        setServerError(undefined);
        const res = await supportAction(data);
        if (!res.ok) {
          setServerError(res.error);
          if (res.fieldErrors) for (const [k, v] of Object.entries(res.fieldErrors)) form.setError(k as keyof In, { message: v });
          return;
        }
        setSent(true);
      })}
    >
      <BotGuard register={(name) => form.register(name)} />
      <div>
        <p className="mb-2 text-sm text-muted">Quick fill</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                form.setValue("topic", p.topic, { shouldDirty: true });
                form.setValue("message", p.message, { shouldDirty: true, shouldValidate: true });
              }}
              className={cn("min-h-[2.25rem] rounded-pill border px-3 text-sm transition active:scale-95", topic === p.topic ? "border-accent text-fg" : "border-line text-muted hover:border-line-strong hover:text-fg")}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" autoComplete="name" required {...form.register("name")} error={errors.name?.message} valid={!!dirtyFields.name && !errors.name} shakeKey={submitCount} />
        <Field label="Email" type="email" autoComplete="email" required {...form.register("email")} error={errors.email?.message} valid={!!dirtyFields.email && !errors.email} shakeKey={submitCount} />
      </div>
      <Field as="select" label="Topic" {...form.register("topic")} error={errors.topic?.message}>
        <option value="order">An order</option>
        <option value="returns">Returns and refunds</option>
        <option value="product">A product</option>
        <option value="account">My account</option>
        <option value="other">Something else</option>
      </Field>
      <Field as="textarea" label="Message" maxLength={2000} showCounter required {...form.register("message")} error={errors.message?.message} valid={!!dirtyFields.message && !errors.message} shakeKey={submitCount} />
      <AnimatePresence>
        {serverError && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" className="rounded-md border border-danger/50 bg-danger/10 p-3 text-sm text-danger">
            {serverError}
          </motion.p>
        )}
      </AnimatePresence>
      <Button type="submit" size="lg" loading={isSubmitting} className="w-full sm:w-auto">
        <Send className="size-4" aria-hidden /> Send message
      </Button>
    </form>
  );
}
