import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/bits";
import { STATUS_LABEL, type OrderStatusValue } from "@/lib/order-state";
import { cn } from "@/lib/utils";

/** Server-safe presentational pieces shared by every admin page. */

export function PageHeader({ title, description, eyebrow, actions }: { title: string; description?: ReactNode; eyebrow?: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
      <div className="min-w-0">
        {eyebrow && <p className="text-2xs uppercase tracking-[0.3em] text-subtle">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-light sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-[46rem] text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({ title, description, actions, children, className, id }: { title?: string; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section aria-labelledby={headingId} className={cn("min-w-0 rounded-lg border border-line bg-surface/60 p-4 sm:p-5", className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h2 id={headingId} className="text-base">
                {title}
              </h2>
            )}
            {description && <p className="mt-0.5 text-xs text-subtle">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const pesoFormat = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
const pesoCompact = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", notation: "compact", maximumFractionDigits: 1 });

/** Whole-peso amounts for dashboards (centavos in, no decimals out). */
export const peso = (centavos: number, { compact = false } = {}) => (compact ? pesoCompact : pesoFormat).format(centavos / 100);

export function Delta({ value, period, upIsGood = true }: { value: number | null; period: string; upIsGood?: boolean }) {
  if (value === null || !Number.isFinite(value)) return <span className="text-xs text-subtle">No data for the previous {period}</span>;
  const pct = Math.round(value * 1000) / 10;
  const flat = Math.abs(pct) < 0.5;
  const good = flat ? null : pct > 0 === upIsGood;
  const Icon = flat ? Minus : pct > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", good === null ? "text-muted" : good ? "text-success" : "text-danger")}>
      <Icon className="size-3.5" aria-hidden />
      <span>
        {pct > 0 ? "+" : ""}
        {pct.toFixed(1)}%
      </span>
      <span className="text-subtle">vs previous {period}</span>
    </span>
  );
}

export function StatTile({ label, value, delta, href, hint, tone }: { label: string; value: ReactNode; delta?: ReactNode; href?: string; hint?: ReactNode; tone?: "warning" | "danger" }) {
  const body = (
    <>
      <p className="text-xs text-muted">{label}</p>
      <p className={cn("mt-2 text-2xl font-normal sm:text-[1.75rem]", tone === "warning" && "text-warning", tone === "danger" && "text-danger")}>{value}</p>
      <div className="mt-1 min-h-[1.25rem]">{delta ?? (hint ? <span className="text-xs text-subtle">{hint}</span> : null)}</div>
    </>
  );
  const cls = "block min-w-0 rounded-lg border border-line bg-surface/60 p-4 transition-colors sm:p-5";
  return href ? (
    <Link href={href} className={cn(cls, "hover:border-line-strong hover:bg-surface")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export const ORDER_TONE: Record<OrderStatusValue, "neutral" | "success" | "warning" | "danger" | "accent"> = {
  pending: "warning",
  paid: "accent",
  packed: "accent",
  shipped: "accent",
  delivered: "success",
  cancelled: "danger",
  refunded: "neutral",
};

export function OrderStatusBadge({ status }: { status: OrderStatusValue }) {
  return <Badge tone={ORDER_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-line px-4 py-10 text-center">
      <span className="text-subtle">{icon}</span>
      <p className="text-sm">{title}</p>
      {children && <div className="max-w-[28rem] text-sm text-muted">{children}</div>}
    </div>
  );
}

/** Pill-style filter links; the active one carries aria-current so it reads as selected. */
export function FilterLinks({ label, options }: { label: string; options: { href: string; label: string; active: boolean; count?: number }[] }) {
  return (
    <nav aria-label={label} className="relative -mx-gutter overflow-x-auto px-gutter sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-2">
        {options.map((o) => (
          <li key={o.href}>
            <Link
              href={o.href}
              scroll={false}
              aria-current={o.active ? "true" : undefined}
              className={cn(
                "inline-flex min-h-[2.5rem] pointer-coarse:min-h-tap items-center gap-2 rounded-pill border px-4 text-sm transition-colors",
                o.active ? "border-fg bg-fg text-bg" : "border-line text-muted hover:border-line-strong hover:text-fg",
              )}
            >
              {o.label}
              {o.count !== undefined && <span className={cn("text-2xs tabular-nums", o.active ? "text-bg/70" : "text-subtle")}>{o.count}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function DeniedNotice({ permission }: { permission: string }) {
  return (
    <p role="alert" className="mb-6 rounded-md border border-warning/50 bg-warning/10 p-3 text-sm text-warning">
      Your role can&apos;t open that page ({permission.replace(":", " · ")}). Ask a Super Admin if you need access.
    </p>
  );
}
