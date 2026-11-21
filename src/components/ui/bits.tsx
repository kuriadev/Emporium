"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { usePrefs } from "@/stores/prefs";

export function Price({ value, compareAt, className, size = "md" }: { value: number; compareAt?: number | null; className?: string; size?: "sm" | "md" | "lg" }) {
  const currency = usePrefs((s) => s.currency);
  const hydrated = useHydrated();
  const cur = hydrated ? currency : "PHP";
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-2", className)}>
      <span className={cn("tabular-nums text-price", size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-lg")}>{formatMoney(value, cur)}</span>
      {compareAt && compareAt > value ? (
        <>
          <s className="text-sm tabular-nums text-subtle">{formatMoney(compareAt, cur)}</s>
          <span className="rounded-pill bg-danger/15 px-2 py-0.5 text-2xs uppercase tracking-wider text-danger">-{Math.round((1 - value / compareAt) * 100)}%</span>
        </>
      ) : null}
    </span>
  );
}

export function Money({ value }: { value: number }) {
  const currency = usePrefs((s) => s.currency);
  const hydrated = useHydrated();
  return <span className="tabular-nums">{formatMoney(value, hydrated ? currency : "PHP")}</span>;
}

export function Stars({ value, count, className, size = "sm" }: { value: number; count?: number; className?: string; size?: "sm" | "md" }) {
  const s = size === "md" ? "size-5" : "size-3.5";
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="inline-flex" role="img" aria-label={`${value.toFixed(1)} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} aria-hidden className={cn(s, i <= Math.round(value) ? "fill-warning text-warning" : "text-subtle/50")} />
        ))}
      </span>
      {count !== undefined && <span className="text-xs text-muted">({count})</span>}
    </span>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "accent"; className?: string }) {
  const tones = {
    neutral: "border-line-strong text-muted",
    success: "border-success/50 bg-success/10 text-success",
    warning: "border-warning/50 bg-warning/10 text-warning",
    danger: "border-danger/50 bg-danger/10 text-danger",
    accent: "border-accent/50 bg-accent/10 text-accent",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5 text-2xs uppercase tracking-[0.12em]", tones[tone], className)}>{children}</span>;
}

export function StockStatus({ stock, threshold = 5 }: { stock: number; threshold?: number }) {
  if (stock <= 0) return <Badge tone="danger">Out of stock</Badge>;
  if (stock <= threshold)
    return (
      <Badge tone="warning">
        <motion.span className="size-1.5 rounded-full bg-warning" animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.4 }} />
        Only {stock} left
      </Badge>
    );
  return (
    <Badge tone="success">
      <span className="size-1.5 rounded-full bg-success" /> In stock
    </Badge>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton", className)} />;
}

/** Invisible honeypot + render timestamp for bot detection (server re-checks both). */
export function BotGuard({ register }: { register: (name: "company" | "startedAt") => object }) {
  return (
    <div aria-hidden className="absolute -left-[625rem] size-px overflow-hidden" tabIndex={-1}>
      <label>
        Company
        <input type="text" autoComplete="off" tabIndex={-1} {...register("company")} />
      </label>
      <input type="hidden" {...register("startedAt")} />
    </div>
  );
}

export function SectionHeading({ id, eyebrow, title, accent, children, className, as: Tag = "h2" }: { id?: string; eyebrow?: string; title: string; accent?: string; children?: React.ReactNode; className?: string; as?: "h1" | "h2" }) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        {eyebrow && <p className="mb-2 text-2xs uppercase tracking-[0.3em] text-subtle">{eyebrow}</p>}
        <Tag id={id} className="text-2xl font-medium">
          {title}
          {accent && <span className="ml-2 font-light text-muted">{accent}</span>}
        </Tag>
      </div>
      {children}
    </div>
  );
}
