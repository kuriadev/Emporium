import { Download, ScrollText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuditDiff } from "@/components/admin/audit-diff";
import { EmptyState, FilterLinks, PageHeader } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button-variants";
import { requestTime } from "@/lib/clock";
import { formatDate } from "@/lib/money";
import { sanitizeText } from "@/lib/security/sanitize";
import { requireAdminPage } from "@/server/auth/guards";
import { AUDIT_ENTITIES, auditEntityCounts, listAudit } from "@/server/services/admin";

export const metadata: Metadata = { title: "Audit log" };

type Props = { searchParams: Promise<{ entity?: string; q?: string; before?: string }> };
type Entity = (typeof AUDIT_ENTITIES)[number];

const PAGE_SIZE = 60;
const ENTITY_LABEL: Record<Entity, string> = { product: "Products", variant: "Variants", order: "Orders", user: "Accounts", promo: "Promotions", media: "Media" };
const ACTION_LABEL: Record<string, string> = {
  "admin.login": "Staff sign-in",
  "customer.update": "Customer account updated",
  "media.upload": "Image uploaded",
  "order.paid": "Order marked paid",
  "order.packed": "Order packed",
  "order.shipped": "Order shipped",
  "order.delivered": "Order delivered",
  "order.cancelled": "Order cancelled by staff",
  "order.cancel": "Order cancelled by customer",
  "order.refunded": "Order refunded in full",
  "order.partial_refund": "Partial refund issued",
  "order.return_rejected": "Return request declined",
  "product.create": "Product created",
  "product.update": "Product edited",
  "product.status": "Product status changed",
  "product.archive": "Product archived",
  "product.delete": "Product deleted",
  "product.bulk_price": "Bulk price change",
  "product.bulk_status": "Bulk status change",
  "product.csv_import": "Product updated by CSV import",
  "variant.stock": "Stock adjusted",
  "variant.bulk_stock": "Bulk stock change",
  "variant.csv_import": "Variant updated by CSV import",
  "promo.create": "Promo code created",
  "promo.update": "Promo code edited",
  "promo.pause": "Promo code paused",
  "promo.resume": "Promo code resumed",
};

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" });
const time = (d: Date) => formatDate(d, { hour: "numeric", minute: "2-digit", second: "2-digit" });

function entityHref(type: string, id: string, action: string): string | null {
  if (type === "product") return action === "product.delete" ? null : `/admin/products/${encodeURIComponent(id)}`;
  if (type === "variant") return `/admin/products?q=${encodeURIComponent(id)}`;
  if (type === "order") return `/admin/orders?q=${encodeURIComponent(id)}`;
  if (type === "user" && action.startsWith("customer.")) return `/admin/customers?q=${encodeURIComponent(id)}`;
  if (type === "promo") return "/admin/promotions";
  return null;
}

export default async function AdminAuditPage({ searchParams }: Props) {
  await requireAdminPage("audit:view", "/admin/audit");
  const sp = await searchParams;
  const entity = AUDIT_ENTITIES.find((e) => e === sp.entity);
  const q = sanitizeText(typeof sp.q === "string" ? sp.q : "").slice(0, 80);
  const cursorMatch = typeof sp.before === "string" ? /^(\d{10,14})\.(\d{1,12})$/.exec(sp.before) : null;
  const cursor = cursorMatch ? { at: Number(cursorMatch[1]), rowid: Number(cursorMatch[2]) } : undefined;

  const rows = listAudit({ entity, q, cursor, limit: PAGE_SIZE + 1 });
  const page = rows.slice(0, PAGE_SIZE);
  const hasMore = rows.length > PAGE_SIZE;
  const counts = auditEntityCounts();
  const total = Object.values(counts).reduce((n, c) => n + c, 0);

  const now = requestTime();
  const today = dayKey.format(now);
  const yesterday = dayKey.format(now - 86_400_000);
  const dayLabel = (d: Date) => {
    const k = dayKey.format(d);
    return k === today ? "Today" : k === yesterday ? "Yesterday" : formatDate(d, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  };
  const groups = Map.groupBy(page, (e) => dayKey.format(e.createdAt));

  const href = (next: { entity?: Entity | null; before?: string | null }) => {
    const params = new URLSearchParams();
    const e = next.entity === undefined ? entity : next.entity;
    if (e) params.set("entity", e);
    if (q) params.set("q", q);
    if (next.before) params.set("before", next.before);
    const s = params.toString();
    return `/admin/audit${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader
        eyebrow="Compliance"
        title="Audit log"
        description="Every staff change: who made it, when, and exactly which fields changed. Entries can't be edited or deleted. Times in Manila."
        actions={
          <a href="/api/admin/export/audit" download className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Download className="size-4" aria-hidden /> Export CSV
          </a>
        }
      />

      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <FilterLinks
          label="Filter by area"
          options={[{ href: href({ entity: null }), label: "Everything", active: !entity, count: total }, ...AUDIT_ENTITIES.map((e) => ({ href: href({ entity: e }), label: ENTITY_LABEL[e], active: entity === e, count: counts[e] ?? 0 }))]}
        />
        <form role="search" action="/admin/audit" className="flex w-full gap-2 xl:w-auto">
          {entity && <input type="hidden" name="entity" value={entity} />}
          <label htmlFor="audit-q" className="sr-only">
            Search the audit log
          </label>
          <input
            id="audit-q"
            name="q"
            type="search"
            defaultValue={q}
            maxLength={80}
            placeholder="Action, SKU, order number or staff email"
            className="min-h-tap w-full rounded-pill border border-line bg-surface/70 px-4 text-sm outline-none transition focus:border-accent focus:shadow-[0_0_0_0.25rem_oklch(0.78_0.11_315/0.25)] xl:w-[20rem]"
          />
          <button type="submit" className={buttonVariants({ variant: "outline", size: "sm", className: "min-h-tap" })}>
            Search
          </button>
        </form>
      </div>

      {page.length === 0 ? (
        <EmptyState icon={<ScrollText className="size-7" />} title={q ? `Nothing matches “${q}”` : "No entries yet"}>
          {q ? (
            <Link href={href({ entity: null })} className="text-accent hover:underline">
              Clear the search
            </Link>
          ) : (
            "Staff changes appear here the moment they're saved."
          )}
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {[...groups].map(([key, entries]) => (
            <section key={key} aria-labelledby={`day-${key}`}>
              <h2 id={`day-${key}`} className="sticky top-[4rem] z-10 -mx-gutter mb-3 bg-bg/85 px-gutter py-2 text-xs uppercase tracking-[0.2em] text-subtle backdrop-blur lg:mx-0 lg:px-0">
                {dayLabel(entries[0]!.createdAt)} <span className="normal-case tracking-normal">· {entries.length} {entries.length === 1 ? "change" : "changes"}</span>
              </h2>
              <ol className="space-y-3">
                {entries.map((e) => {
                  const link = entityHref(e.entityType, e.entityId, e.action);
                  return (
                    <li key={e.id} className="rounded-lg border border-line bg-surface/50 p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <p className="min-w-0">
                          <span className="text-sm">{ACTION_LABEL[e.action] ?? e.action}</span>{" "}
                          {link ? (
                            <Link href={link} className="break-all font-mono text-xs text-accent hover:underline">
                              {e.entityId}
                            </Link>
                          ) : (
                            <span className="break-all font-mono text-xs text-muted">{e.entityId}</span>
                          )}
                        </p>
                        <p className="text-xs text-subtle">
                          <time dateTime={e.createdAt.toISOString()}>{time(e.createdAt)}</time>
                        </p>
                      </div>
                      <p className="mt-0.5 text-xs text-subtle">
                        <span className="font-mono">{e.action}</span> · {e.actorEmail}
                      </p>
                      {(e.before || e.after) && (
                        <div className="mt-3">
                          <AuditDiff before={e.before} after={e.after} />
                        </div>
                      )}
                      {e.reason && <p className="mt-2 text-xs text-muted">Reason: {e.reason}</p>}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}

      {(hasMore || cursor) && (
        <nav aria-label="Audit log pages" className="mt-8 flex flex-wrap justify-between gap-3">
          {cursor ? (
            <Link href={href({ before: null })} className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Back to newest
            </Link>
          ) : (
            <span />
          )}
          {hasMore && (
            <Link href={href({ before: `${page.at(-1)!.createdAt.getTime()}.${page.at(-1)!.rowid}` })} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Older entries
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
