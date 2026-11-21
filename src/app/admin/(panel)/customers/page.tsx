import { ArrowDown, NotebookPen, UserRoundSearch } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, FilterLinks, PageHeader, StatTile, peso } from "@/components/admin/ui";
import { Badge } from "@/components/ui/bits";
import { buttonVariants } from "@/components/ui/button-variants";
import { formatDate, formatMoney, formatRelative } from "@/lib/money";
import { sanitizeText } from "@/lib/security/sanitize";
import { cn } from "@/lib/utils";
import { requestTime } from "@/lib/clock";
import { requireAdminPage } from "@/server/auth/guards";
import { listCustomers, type AdminCustomer } from "@/server/services/admin";

export const metadata: Metadata = { title: "Customers" };

type Props = { searchParams: Promise<{ q?: string; segment?: string; sort?: string }> };

const DAY = 86_400_000;
const LAPSED_AFTER_DAYS = 60;
const NEW_WITHIN_DAYS = 30;

const SEGMENTS = {
  all: { label: "All", test: () => true },
  repeat: { label: "Repeat buyers", test: (c: AdminCustomer) => c.paidOrders >= 2 },
  lapsed: { label: `No order in ${LAPSED_AFTER_DAYS} days`, test: (c: AdminCustomer, now: number) => c.paidOrders > 0 && !!c.lastOrder && now - c.lastOrder.getTime() > LAPSED_AFTER_DAYS * DAY },
  new: { label: `Joined in ${NEW_WITHIN_DAYS} days`, test: (c: AdminCustomer, now: number) => now - c.createdAt.getTime() <= NEW_WITHIN_DAYS * DAY },
  suspended: { label: "Suspended", test: (c: AdminCustomer) => c.status === "suspended" },
} as const;
type Segment = keyof typeof SEGMENTS;

const SORTS = {
  ltv: { label: "Lifetime value", value: (c: AdminCustomer) => c.ltv },
  orders: { label: "Orders", value: (c: AdminCustomer) => c.orders },
  recent: { label: "Last order", value: (c: AdminCustomer) => c.lastOrder?.getTime() ?? 0 },
  joined: { label: "Joined", value: (c: AdminCustomer) => c.createdAt.getTime() },
} as const;
type Sort = keyof typeof SORTS;

const isKey = <T extends object>(obj: T, k: unknown): k is keyof T => typeof k === "string" && Object.hasOwn(obj, k);

export default async function AdminCustomersPage({ searchParams }: Props) {
  await requireAdminPage("customers:view", "/admin/customers");
  const sp = await searchParams;
  const q = sanitizeText(typeof sp.q === "string" ? sp.q : "").slice(0, 80);
  const segment: Segment = isKey(SEGMENTS, sp.segment) ? sp.segment : "all";
  const sort: Sort = isKey(SORTS, sp.sort) ? sp.sort : "ltv";
  const now = requestTime();

  const everyone = listCustomers();
  const matching = q ? listCustomers(q) : everyone;
  const rows = matching.filter((c) => SEGMENTS[segment].test(c, now)).sort((a, b) => SORTS[sort].value(b) - SORTS[sort].value(a));

  const buyers = everyone.filter((c) => c.paidOrders > 0);
  const repeaters = buyers.filter((c) => c.paidOrders >= 2).length;
  const joinedRecently = everyone.filter((c) => SEGMENTS.new.test(c, now)).length;
  const suspended = everyone.filter((c) => c.status === "suspended").length;
  const avgLtv = buyers.length ? Math.round(buyers.reduce((n, c) => n + c.ltv, 0) / buyers.length) : 0;

  const href = (next: { segment?: Segment; sort?: Sort }) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    const seg = next.segment ?? segment;
    const so = next.sort ?? sort;
    if (seg !== "all") params.set("segment", seg);
    if (so !== "ltv") params.set("sort", so);
    const s = params.toString();
    return `/admin/customers${s ? `?${s}` : ""}`;
  };
  const lastOrder = (c: AdminCustomer) => (c.lastOrder ? formatRelative(c.lastOrder, now) : "No orders yet");

  const sortHeader = (key: Sort, align: "left" | "right" = "right") => (
    <th scope="col" aria-sort={sort === key ? "descending" : undefined} className={cn("px-3 py-3 font-normal", align === "right" && "text-right")}>
      <Link href={href({ sort: key })} scroll={false} className={cn("inline-flex min-h-[2rem] items-center gap-1 hover:text-fg", align === "right" && "flex-row-reverse", sort === key && "text-fg")}>
        {SORTS[key].label}
        <ArrowDown className={cn("size-3.5", sort === key ? "opacity-100" : "opacity-0")} aria-hidden />
      </Link>
    </th>
  );

  return (
    <>
      <PageHeader eyebrow="CRM" title="Customers" description="Lifetime value, order history and account status for every shopper. Lifetime value is paid orders minus refunds." />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Customers" value={everyone.length.toLocaleString("en-PH")} hint={`${joinedRecently} joined in the last ${NEW_WITHIN_DAYS} days`} href={href({ segment: "new" })} />
        <StatTile label="Repeat purchase rate" value={buyers.length ? `${Math.round((repeaters / buyers.length) * 100)}%` : "–"} hint={`${repeaters} of ${buyers.length} buyers ordered twice or more`} href={href({ segment: "repeat" })} />
        <StatTile label="Average lifetime value" value={peso(avgLtv)} hint="Across customers with a paid order" />
        <StatTile label="Suspended accounts" value={suspended} tone={suspended ? "warning" : undefined} hint={suspended ? "Can't sign in or check out" : "Nobody is suspended"} href={href({ segment: "suspended" })} />
      </div>

      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <FilterLinks
          label="Customer segments"
          options={(Object.keys(SEGMENTS) as Segment[]).map((s) => ({ href: href({ segment: s }), label: SEGMENTS[s].label, active: segment === s, count: matching.filter((c) => SEGMENTS[s].test(c, now)).length }))}
        />
        <form role="search" action="/admin/customers" className="flex w-full gap-2 xl:w-auto">
          {segment !== "all" && <input type="hidden" name="segment" value={segment} />}
          {sort !== "ltv" && <input type="hidden" name="sort" value={sort} />}
          <label htmlFor="customer-q" className="sr-only">
            Search customers
          </label>
          <input
            id="customer-q"
            name="q"
            type="search"
            defaultValue={q}
            maxLength={80}
            placeholder="Name or email"
            className="min-h-tap w-full rounded-pill border border-line bg-surface/70 px-4 text-sm outline-none transition focus:border-accent focus:shadow-[0_0_0_0.25rem_oklch(0.78_0.11_315/0.25)] xl:w-[18rem]"
          />
          <button type="submit" className={buttonVariants({ variant: "outline", size: "sm", className: "min-h-tap" })}>
            Search
          </button>
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<UserRoundSearch className="size-7" />} title={q ? `No customers match “${q}”` : "Nobody in this segment"}>
          {q ? (
            <>
              Check the spelling or search by email instead.{" "}
              <Link href="/admin/customers" className="text-accent hover:underline">
                Clear the search
              </Link>
            </>
          ) : (
            "Try another segment."
          )}
        </EmptyState>
      ) : (
        <>
          <p className="mb-3 text-xs text-subtle">
            {rows.length} {rows.length === 1 ? "customer" : "customers"} · sorted by {SORTS[sort].label.toLowerCase()}
          </p>
          <nav aria-label="Sort customers" className="relative -mx-gutter mb-3 overflow-x-auto px-gutter md:hidden">
            <ul className="flex w-max items-center gap-2 text-xs">
              <li className="text-subtle">Sort by</li>
              {(Object.keys(SORTS) as Sort[]).map((k) => (
                <li key={k}>
                  <Link
                    href={href({ sort: k })}
                    scroll={false}
                    aria-current={sort === k ? "true" : undefined}
                    className={cn("inline-flex min-h-tap items-center rounded-pill border px-3", sort === k ? "border-fg text-fg" : "border-line text-muted")}
                  >
                    {SORTS[k].label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="relative hidden overflow-x-auto rounded-lg border border-line md:block">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="bg-surface text-xs text-subtle">
                <tr>
                  <th scope="col" className="sticky left-0 z-10 bg-surface px-4 py-3 font-normal">
                    Customer
                  </th>
                  {sortHeader("orders")}
                  {sortHeader("ltv")}
                  <th scope="col" className="px-3 py-3 text-right font-normal">
                    Avg. order
                  </th>
                  {sortHeader("recent", "left")}
                  {sortHeader("joined", "left")}
                  <th scope="col" className="px-3 py-3 font-normal">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((c) => (
                  <tr key={c.id} className="group hover:bg-white/[0.03]">
                    <td className="sticky left-0 z-10 max-w-[18rem] bg-bg px-4 py-3 group-hover:bg-[oklch(0.1_0_0)]">
                      <Link href={`/admin/customers/${c.id}`} className="flex items-center gap-1.5 text-fg hover:underline">
                        <span className="truncate">{c.name}</span>
                        {c.notes && <NotebookPen className="size-3.5 shrink-0 text-accent" aria-label="Has staff notes" />}
                      </Link>
                      <span className="block truncate text-xs text-subtle">{c.email}</span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{c.orders}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatMoney(c.ltv)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted">{c.aov ? formatMoney(c.aov) : "–"}</td>
                    <td className="px-3 py-3 text-muted">{lastOrder(c)}</td>
                    <td className="px-3 py-3 text-muted">{formatDate(c.createdAt, { month: "short", day: "numeric", year: "numeric" })}</td>
                    <td className="px-3 py-3">{c.status === "suspended" ? <Badge tone="danger">Suspended</Badge> : <Badge tone="success">Active</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {rows.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/customers/${c.id}`} className={cn("block rounded-lg border bg-surface/50 p-4 transition-colors active:bg-surface", c.status === "suspended" ? "border-danger/40" : "border-line")}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate">{c.name}</span>
                        {c.notes && <NotebookPen className="size-3.5 shrink-0 text-accent" aria-label="Has staff notes" />}
                      </span>
                      <span className="block truncate text-xs text-subtle">{c.email}</span>
                    </span>
                    <span className="shrink-0 text-right tabular-nums">
                      {formatMoney(c.ltv)}
                      <span className="block text-xs text-subtle">lifetime</span>
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    <span>
                      {c.orders} {c.orders === 1 ? "order" : "orders"}
                    </span>
                    <span>Last: {lastOrder(c)}</span>
                    {c.status === "suspended" && (
                      <Badge tone="danger" className="ml-auto">
                        Suspended
                      </Badge>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
