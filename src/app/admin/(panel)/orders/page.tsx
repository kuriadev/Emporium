import { Download, PackageSearch, Undo2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, FilterLinks, OrderStatusBadge, PageHeader } from "@/components/admin/ui";
import { Badge } from "@/components/ui/bits";
import { buttonVariants } from "@/components/ui/button-variants";
import { formatDate, formatMoney } from "@/lib/money";
import { ORDER_FLOW, STATUS_LABEL, type OrderStatusValue } from "@/lib/order-state";
import { sanitizeText } from "@/lib/security/sanitize";
import { cn } from "@/lib/utils";
import { requireAdminPage } from "@/server/auth/guards";
import { listAdminOrders } from "@/server/services/admin";

export const metadata: Metadata = { title: "Orders" };

type Props = { searchParams: Promise<{ q?: string; status?: string }> };
const FILTERS = [...ORDER_FLOW, "cancelled", "refunded", "returns"] as const;
type Filter = (typeof FILTERS)[number];
const PAYMENT: Record<string, string> = { card: "Card", gcash: "GCash", cod: "Cash on delivery" };
const SHOWN = 100;

export default async function AdminOrdersPage({ searchParams }: Props) {
  await requireAdminPage("orders:view", "/admin/orders");
  const sp = await searchParams;
  const q = sanitizeText(typeof sp.q === "string" ? sp.q : "").slice(0, 60);
  const status: Filter | "" = FILTERS.find((f) => f === sp.status) ?? "";

  const matching = listAdminOrders({ q });
  const rows = status ? matching.filter((r) => (status === "returns" ? r.order.returnStatus === "requested" : r.order.status === status)) : matching;
  const count = (f: Filter) => matching.filter((r) => (f === "returns" ? r.order.returnStatus === "requested" : r.order.status === f)).length;
  const href = (f: Filter | "") => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (f) params.set("status", f);
    const s = params.toString();
    return `/admin/orders${s ? `?${s}` : ""}`;
  };
  const label = (f: Filter) => (f === "returns" ? "Return requests" : f === "paid" ? "To pack" : f === "packed" ? "To ship" : STATUS_LABEL[f]);
  const placed = (d: Date) => formatDate(d, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });

  return (
    <>
      <PageHeader
        eyebrow="Fulfilment"
        title="Orders"
        description="Move orders through Pending → Paid → Packed → Shipped → Delivered. Refunds and cancellations need a reason."
        actions={
          <a href="/api/admin/export/orders" download className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Download className="size-4" aria-hidden /> Export CSV
          </a>
        }
      />

      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <FilterLinks
          label="Filter orders"
          options={[{ href: href(""), label: "All", active: !status, count: matching.length }, ...FILTERS.map((f) => ({ href: href(f), label: label(f), active: status === f, count: count(f) }))]}
        />
        <form role="search" action="/admin/orders" className="flex w-full gap-2 xl:w-auto">
          {status && <input type="hidden" name="status" value={status} />}
          <label htmlFor="order-q" className="sr-only">
            Search orders
          </label>
          <input
            id="order-q"
            name="q"
            defaultValue={q}
            maxLength={60}
            placeholder="Order number, email or name"
            className="min-h-tap w-full rounded-pill border border-line bg-surface/70 px-4 text-sm outline-none transition focus:border-accent focus:shadow-[0_0_0_0.25rem_oklch(0.78_0.11_315/0.25)] xl:w-[18rem]"
          />
          <button type="submit" className={buttonVariants({ variant: "outline", size: "sm", className: "min-h-tap" })}>
            Search
          </button>
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<PackageSearch className="size-7" />} title={q ? `No orders match “${q}”` : "Nothing in this queue"}>
          {status ? "Every order in this stage has been handled." : "Orders appear here as soon as shoppers check out."}
        </EmptyState>
      ) : (
        <>
          <p className="mb-3 text-xs text-subtle">
            {rows.length > SHOWN ? `Showing the latest ${SHOWN} of ${rows.length} orders` : `${rows.length} ${rows.length === 1 ? "order" : "orders"}`} · times in Manila
          </p>
          <div className="relative hidden overflow-x-auto rounded-lg border border-line md:block">
            <table className="w-full min-w-[58rem] text-left text-sm">
              <thead className="bg-surface text-xs text-subtle">
                <tr>
                  <th scope="col" className="sticky left-0 z-10 bg-surface px-4 py-3 font-normal">
                    Order
                  </th>
                  <th scope="col" className="px-3 py-3 font-normal">
                    Customer
                  </th>
                  <th scope="col" className="px-3 py-3 font-normal">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-3 font-normal">
                    Payment
                  </th>
                  <th scope="col" className="px-3 py-3 font-normal">
                    Shipping
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-normal">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.slice(0, SHOWN).map(({ order: o, customer, items }) => (
                  <tr key={o.id} className="group hover:bg-white/[0.03]">
                    <td className="sticky left-0 z-10 bg-bg px-4 py-3 group-hover:bg-[oklch(0.1_0_0)]">
                      <Link href={`/admin/orders/${o.id}`} className="font-mono text-fg hover:underline">
                        {o.number}
                      </Link>
                      <span className="block text-xs text-subtle">{placed(o.createdAt)}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="block">{customer ?? o.shippingAddress.fullName}</span>
                      <span className="block text-xs text-subtle">{o.email}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <OrderStatusBadge status={o.status as OrderStatusValue} />
                        {o.returnStatus === "requested" && (
                          <Badge tone="warning">
                            <Undo2 className="mr-1 inline size-3" aria-hidden />
                            Return
                          </Badge>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-muted">
                      {PAYMENT[o.paymentMethod]}
                      {o.paymentLast4 ? ` ·· ${o.paymentLast4}` : ""}
                    </td>
                    <td className="px-3 py-3 text-muted">
                      {o.trackingNumber ? (
                        <>
                          <span className="block">{o.carrier}</span>
                          <span className="block font-mono text-xs text-subtle">{o.trackingNumber}</span>
                        </>
                      ) : (
                        <span className="capitalize">{o.shippingTier}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatMoney(o.total)}
                      <span className="block text-xs text-subtle">
                        {items} {items === 1 ? "item" : "items"}
                        {o.refundedAmount > 0 && <span className="text-warning"> · −{formatMoney(o.refundedAmount)}</span>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {rows.slice(0, SHOWN).map(({ order: o, customer, items }) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className={cn("block rounded-lg border bg-surface/50 p-4 transition-colors active:bg-surface", o.returnStatus === "requested" ? "border-warning/50" : "border-line")}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block font-mono text-sm">{o.number}</span>
                      <span className="block truncate text-xs text-subtle">
                        {customer ?? o.shippingAddress.fullName} · {placed(o.createdAt)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right tabular-nums">
                      {formatMoney(o.total)}
                      <span className="block text-xs text-subtle">
                        {items} {items === 1 ? "item" : "items"}
                      </span>
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <OrderStatusBadge status={o.status as OrderStatusValue} />
                    {o.returnStatus === "requested" && <Badge tone="warning">Return requested</Badge>}
                    <span className="ml-auto text-xs text-subtle">{PAYMENT[o.paymentMethod]}</span>
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
