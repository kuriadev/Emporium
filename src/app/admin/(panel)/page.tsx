import { Boxes, PackageCheck, SearchX, ShoppingCart, Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { RevenueChart, type RevenuePoint } from "@/components/admin/revenue-chart";
import { DeniedNotice, Delta, EmptyState, FilterLinks, PageHeader, Panel, StatTile, peso } from "@/components/admin/ui";
import { formatDate } from "@/lib/money";
import { cn } from "@/lib/utils";
import { requireAdminPage } from "@/server/auth/guards";
import { can, PERMISSIONS } from "@/server/auth/permissions";
import { abandonedCartItems, DASHBOARD_RANGES, dashboardKpis, fulfilmentQueue, restockQueue, zeroResultSearches, type DashboardRange } from "@/server/services/admin";

export const metadata: Metadata = { title: "Dashboard" };

type Props = { searchParams: Promise<{ range?: string; denied?: string }> };

function weekly(daily: RevenuePoint[]): RevenuePoint[] {
  const out: RevenuePoint[] = [];
  for (let i = 0; i < daily.length; i += 7) {
    const chunk = daily.slice(i, i + 7);
    out.push({ day: chunk[0]!.day, revenue: chunk.reduce((a, d) => a + d.revenue, 0), orders: chunk.reduce((a, d) => a + d.orders, 0) });
  }
  return out;
}

function ago(ms: number): string {
  const mins = Math.max(1, Math.round((Date.now() - ms) / 60_000));
  if (mins < 60) return `${mins} min`;
  const hours = Math.round(mins / 60);
  return hours < 48 ? `${hours} h` : `${Math.round(hours / 24)} days`;
}

const STAGES = [
  { status: "pending", label: "Awaiting payment", hint: "COD and unpaid", icon: ShoppingCart },
  { status: "paid", label: "Ready to pack", hint: "Paid, not packed", icon: Boxes },
  { status: "packed", label: "Ready to ship", hint: "Needs a tracking number", icon: PackageCheck },
  { status: "shipped", label: "In transit", hint: "With the courier", icon: Truck },
] as const;

export default async function DashboardPage({ searchParams }: Props) {
  const admin = await requireAdminPage("dashboard:view", "/admin");
  const sp = await searchParams;
  const range: DashboardRange = DASHBOARD_RANGES.find((r) => String(r) === sp.range) ?? 30;
  const denied = typeof sp.denied === "string" && Object.hasOwn(PERMISSIONS, sp.denied) ? sp.denied : null;

  const k = dashboardKpis(range);
  const queue = fulfilmentQueue();
  const restock = restockQueue(8);
  const searches = zeroResultSearches(6, range);
  const carts = abandonedCartItems(6);
  const period = `${range} days`;
  const points = range === 90 ? weekly(k.daily) : k.daily;
  const canOrders = can(admin.adminRole, "orders:view");
  const canCatalog = can(admin.adminRole, "catalog:write");

  const hour = Number(new Intl.DateTimeFormat("en-PH", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Manila" }).format(new Date()));
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <>
      <PageHeader
        eyebrow={formatDate(new Date(), { weekday: "long", month: "long", day: "numeric", timeZone: "Asia/Manila" })}
        title={`${greeting}, ${admin.name.split(" ")[0]}`}
        description={`Here's how Emporium is doing over the last ${period}. Times are Manila time.`}
        actions={<FilterLinks label="Date range" options={DASHBOARD_RANGES.map((r) => ({ href: `/admin?range=${r}`, label: `Last ${r} days`, active: r === range }))} />}
      />
      {denied && <DeniedNotice permission={denied} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Paid orders" value={k.orders.toLocaleString("en-PH")} delta={<Delta value={k.ordersDelta} period={period} />} />
        <StatTile label="Average order value" value={peso(k.aov)} delta={<Delta value={k.aovDelta} period={period} />} />
        <StatTile label="Customers who ordered" value={k.activeCustomers.toLocaleString("en-PH")} delta={<Delta value={k.customersDelta} period={period} />} />
        <StatTile
          label="Needs action now"
          value={k.openOrders + k.returnRequests}
          tone={k.openOrders + k.returnRequests > 0 ? "warning" : undefined}
          hint={`${k.openOrders} open · ${k.returnRequests} return ${k.returnRequests === 1 ? "request" : "requests"}`}
          href={canOrders ? (k.returnRequests ? "/admin/orders?status=returns" : "/admin/orders?status=paid") : undefined}
        />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel id="revenue" title="Net revenue" description={`${range === 90 ? "Per week" : "Per day"}, after refunds. Cancelled and unpaid orders are excluded.`}>
          <div className="mb-4 flex flex-wrap items-end gap-x-4 gap-y-1">
            <p className="text-[clamp(2.5rem,1.8rem+2.4vw,3.5rem)] font-light leading-none">{peso(k.revenue)}</p>
            <Delta value={k.revenueDelta} period={period} />
          </div>
          <RevenueChart points={points} unit={range === 90 ? "week" : "day"} title={`Net revenue per ${range === 90 ? "week" : "day"}, last ${period}`} />
        </Panel>

        <Panel id="queue" title="Fulfilment queue" description="Live, not limited to the date range.">
          <ul className="divide-y divide-line">
            {STAGES.map(({ status, label, hint, icon: Icon }) => {
              const row = queue[status];
              const content = (
                <>
                  <span className="grid size-10 shrink-0 place-items-center rounded-md border border-line text-muted">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm">{label}</span>
                    <span className="block text-xs text-subtle">{row ? `Oldest ${ago(row.oldest)} ago` : hint}</span>
                  </span>
                  <span className={cn("text-xl tabular-nums", row?.n ? "text-fg" : "text-subtle")}>{row?.n ?? 0}</span>
                </>
              );
              return (
                <li key={status}>
                  {canOrders ? (
                    <Link href={`/admin/orders?status=${status}`} className="-mx-2 flex min-h-[3.5rem] items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-white/5">
                      {content}
                    </Link>
                  ) : (
                    <div className="flex min-h-[3.5rem] items-center gap-3 py-2">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
          {k.returnRequests > 0 && (
            <p className="mt-3 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
              {k.returnRequests} return {k.returnRequests === 1 ? "request is" : "requests are"} waiting for a decision.{" "}
              {canOrders && (
                <Link href="/admin/orders?status=returns" className="underline underline-offset-4">
                  Review returns
                </Link>
              )}
            </p>
          )}
        </Panel>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <Panel
          id="restock"
          title="Needs restock"
          description="Variants at or below their reorder point, lowest first."
          actions={
            canCatalog ? (
              <Link href="/admin/products?stock=low" className="inline-flex min-h-tap items-center text-sm text-accent hover:underline">
                All low stock
              </Link>
            ) : undefined
          }
        >
          {restock.length === 0 ? (
            <EmptyState icon={<PackageCheck className="size-6" />} title="Everything is stocked">
              No variant is at its reorder point.
            </EmptyState>
          ) : (
            <ul className="space-y-3">
              {restock.map((r) => {
                const pct = r.threshold ? Math.min(100, (r.stock / r.threshold) * 100) : 0;
                const name = canCatalog ? (
                  <Link href={`/admin/products/${r.productId}`} className="hover:underline">
                    {r.productName}
                  </Link>
                ) : (
                  r.productName
                );
                return (
                  <li key={r.variantId} className="text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate">{name}</span>
                      <span className={cn("shrink-0 tabular-nums", r.stock === 0 ? "text-danger" : "text-warning")}>
                        {r.stock === 0 ? "Sold out" : `${r.stock} left`}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-subtle">
                      <span className="font-mono">{r.sku}</span>
                      <span>reorder at {r.threshold}</span>
                      {r.alerts > 0 && <span className="text-accent">{r.alerts} waiting for restock email</span>}
                    </div>
                    <div className="mt-1.5 h-[0.375rem] rounded-pill bg-warning/15" role="img" aria-label={`${r.stock} of ${r.threshold} reorder point`}>
                      <div className={cn("h-full rounded-pill", r.stock === 0 ? "bg-danger" : "bg-warning")} style={{ width: `${Math.max(pct, r.stock ? 4 : 0)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel id="zero" title="Searches with no results" description={`What shoppers looked for and didn't find, last ${period}.`}>
          {searches.length === 0 ? (
            <EmptyState icon={<SearchX className="size-6" />} title="Every search found something" />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-subtle">
                <tr>
                  <th scope="col" className="pb-2 font-normal">
                    Query
                  </th>
                  <th scope="col" className="pb-2 text-right font-normal">
                    Searches
                  </th>
                  <th scope="col" className="hidden pb-2 text-right font-normal sm:table-cell">
                    Last seen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {searches.map((s) => (
                  <tr key={s.query}>
                    <td className="py-2">
                      <Link href={`/products?q=${encodeURIComponent(s.query)}`} className="hover:underline" title="Run this search on the storefront">
                        “{s.query}”
                      </Link>
                    </td>
                    <td className="py-2 text-right tabular-nums">{s.n}</td>
                    <td className="hidden py-2 text-right text-subtle sm:table-cell">{ago(s.last)} ago</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-xs text-subtle">Recurring misses are candidates for new products, synonyms or a landing page.</p>
        </Panel>

        <Panel id="carts" title="Abandoned carts" description="Items sitting in bags for more than 24 hours.">
          {carts.length === 0 ? (
            <EmptyState icon={<ShoppingCart className="size-6" />} title="No abandoned bags" />
          ) : (
            <ul className="divide-y divide-line text-sm">
              {carts.map((c) => (
                <li key={c.sku} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate">{c.productName}</span>
                    <span className="block text-xs text-subtle">
                      <span className="font-mono">{c.sku}</span> · {c.carts} {c.carts === 1 ? "bag" : "bags"} · {c.units} {c.units === 1 ? "unit" : "units"}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">{peso(c.value)}</span>
                </li>
              ))}
            </ul>
          )}
          {carts.length > 0 && (
            <p className="mt-3 text-xs text-subtle">
              {peso(carts.reduce((a, c) => a + c.value, 0))} in merchandise is waiting in these bags.
            </p>
          )}
        </Panel>
      </div>
    </>
  );
}
