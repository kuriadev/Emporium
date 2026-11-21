import { Gift, Mail, Package, Phone } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditDiff } from "@/components/admin/audit-diff";
import { OrderWorkbench, PrintButton } from "@/components/admin/order-workbench";
import { OrderStatusBadge, PageHeader, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/bits";
import { formatDate, formatMoney } from "@/lib/money";
import type { OrderStatusValue } from "@/lib/order-state";
import { SHIPPING_RATES } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { requireAdminPage } from "@/server/auth/guards";
import { can } from "@/server/auth/permissions";
import { getAdminOrder } from "@/server/services/admin";

type Props = { params: Promise<{ id: string }> };
const validId = (id: string) => /^[A-Za-z0-9-]{1,64}$/.test(id);
const dt = (d: Date | number) => formatDate(d, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });
const PAYMENT: Record<string, string> = { card: "Card", gcash: "GCash", cod: "Cash on delivery" };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = validId(id) ? getAdminOrder(id) : null;
  return { title: data ? `Order ${data.order.number}` : "Order not found" };
}

export default async function AdminOrderPage({ params }: Props) {
  const { id } = await params;
  const admin = await requireAdminPage("orders:view", `/admin/orders/${encodeURIComponent(id)}`);
  if (!validId(id)) notFound();
  const data = getAdminOrder(id);
  if (!data) notFound();
  const { order: o, items, events, customer, audit } = data;
  const a = o.shippingAddress;
  const status = o.status as OrderStatusValue;
  const canCustomers = can(admin.adminRole, "customers:view");

  const breakdown: [string, number][] = (
    [
      ["Subtotal", o.subtotal],
      ["Volume pricing", -o.tierDiscount],
      ["Bundle savings", -o.bundleDiscount],
      [`Promo${o.promoCodes.length ? ` (${o.promoCodes.join(", ")})` : ""}`, -o.promoDiscount],
      [`Shipping · ${SHIPPING_RATES[o.shippingTier].label}`, o.shippingFee],
      ["Gift wrap", o.giftWrapFee],
    ] as [string, number][]
  ).filter(([label, v]) => v !== 0 || label === "Subtotal" || label.startsWith("Shipping"));

  return (
    <div className="print-sheet">
      <PageHeader
        eyebrow={`Placed ${dt(o.createdAt)}`}
        title={`Order ${o.number}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={status} />
            {o.returnStatus !== "none" && <Badge tone={o.returnStatus === "requested" ? "warning" : "neutral"}>Return {o.returnStatus}</Badge>}
            {o.refundedAmount > 0 && <Badge tone="neutral">Refunded {formatMoney(o.refundedAmount)}</Badge>}
            <Link href="/admin/orders" className="no-print text-accent hover:underline">
              All orders
            </Link>
          </span>
        }
        actions={<PrintButton />}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-4">
          <Panel id="next" title="Next step" description="Each change is timestamped, attributed to you and written to the audit log." className="no-print">
            <OrderWorkbench
              order={{ id: o.id, number: o.number, status, returnStatus: o.returnStatus, returnReason: o.returnReason, total: o.total, refunded: o.refundedAmount, shippingFee: o.shippingFee }}
              canFulfill={can(admin.adminRole, "orders:fulfill")}
              canRefund={can(admin.adminRole, "orders:refund")}
            />
          </Panel>

          <Panel id="items" title={`Items (${items.reduce((n, it) => n + it.quantity, 0)})`}>
            <ul className="divide-y divide-line">
              {items.map((it) => (
                <li key={it.id} className="flex items-center gap-4 py-3">
                  <span className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-sm bg-white">
                    {it.image ? <Image src={it.image} alt="" fill sizes="3.5rem" className="object-cover" /> : <Package className="size-5 text-bg" aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1">
                    {it.productId ? (
                      <Link href={`/admin/products/${it.productId}`} className="block truncate hover:underline">
                        {it.name}
                      </Link>
                    ) : (
                      <span className="block truncate">{it.name}</span>
                    )}
                    <span className="block text-xs text-subtle">
                      {it.variantLabel} · <span className="font-mono">{it.sku}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-sm tabular-nums">
                    {formatMoney(it.lineTotal)}
                    <span className="block text-xs text-subtle">
                      {it.quantity} × {formatMoney(it.unitPrice)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1.5 border-t border-line pt-3 text-sm">
              {breakdown.map(([label, v]) => (
                <div key={label} className={cn("flex justify-between gap-4", v < 0 ? "text-price" : "text-muted")}>
                  <dt>{label}</dt>
                  <dd className="tabular-nums">{v < 0 ? `−${formatMoney(-v)}` : v === 0 ? "Free" : formatMoney(v)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 border-t border-line pt-2 text-base">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatMoney(o.total)}</dd>
              </div>
              {o.refundedAmount > 0 && (
                <div className="flex justify-between gap-4 text-warning">
                  <dt>Refunded</dt>
                  <dd className="tabular-nums">−{formatMoney(o.refundedAmount)}</dd>
                </div>
              )}
              <p className="text-xs text-subtle">
                Includes {formatMoney(o.taxIncluded)} VAT · {PAYMENT[o.paymentMethod]}
                {o.paymentLast4 ? ` ending ${o.paymentLast4}` : ""}
              </p>
            </dl>
          </Panel>

          <Panel id="timeline" title="Timeline">
            <ol className="space-y-4 border-l border-line pl-5">
              {events.map(({ event: e, actor, actorRole }) => (
                <li key={e.id} className="relative text-sm">
                  <span aria-hidden className="absolute -left-[1.6875rem] top-1 size-3 rounded-full border-2 border-bg bg-accent" />
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="capitalize">{e.status.replace(/_/g, " ")}</span>
                    <span className="text-xs text-subtle">{dt(e.createdAt)}</span>
                  </p>
                  {e.note && <p className="text-muted">{e.note}</p>}
                  <p className="text-xs text-subtle">{actor ? `${actor}${actorRole === "admin" ? " (staff)" : ""}` : "System"}</p>
                </li>
              ))}
            </ol>
          </Panel>

          {audit.length > 0 && (
            <Panel id="audit" title="Audit trail" description="Field-level before and after for every staff change." className="no-print">
              <ul className="space-y-3 text-sm">
                {audit.map((entry) => (
                  <li key={entry.id} className="rounded-md border border-line p-3">
                    <p className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-mono text-xs">{entry.action}</span>
                      <span className="text-xs text-subtle">
                        {entry.actorEmail} · {dt(entry.createdAt)}
                      </span>
                    </p>
                    <div className="mt-2">
                      <AuditDiff before={entry.before} after={entry.after} />
                    </div>
                    {entry.reason && <p className="mt-1 text-xs text-muted">Reason: {entry.reason}</p>}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <Panel id="customer" title="Customer">
            <p>{customer?.name ?? a.fullName}</p>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted">
              <Mail className="size-3.5" aria-hidden />
              <a href={`mailto:${o.email}`} className="truncate hover:text-fg hover:underline">
                {o.email}
              </a>
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted">
              <Phone className="size-3.5" aria-hidden />
              <a href={`tel:${a.phone.replace(/[^+\d]/g, "")}`} className="hover:text-fg hover:underline">
                {a.phone}
              </a>
            </p>
            {customer ? (
              <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
                <div>
                  <dt className="text-2xs text-subtle">Orders</dt>
                  <dd className="mt-1">{customer.orders}</dd>
                </div>
                <div>
                  <dt className="text-2xs text-subtle">Lifetime value</dt>
                  <dd className="mt-1">{formatMoney(customer.ltv)}</dd>
                </div>
                <div>
                  <dt className="text-2xs text-subtle">Status</dt>
                  <dd className={cn("mt-1 capitalize", customer.status === "suspended" && "text-danger")}>{customer.status}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-3 text-xs text-subtle">This customer deleted their account. Order details are kept for tax records.</p>
            )}
            {customer?.notes && <p className="mt-3 rounded-md bg-accent/10 p-3 text-xs text-accent">Note: {customer.notes}</p>}
            {customer && canCustomers && (
              <Link href={`/admin/customers/${customer.id}`} className="no-print mt-3 inline-flex min-h-tap items-center text-sm text-accent hover:underline">
                Open customer profile
              </Link>
            )}
          </Panel>

          <Panel id="shipto" title="Ship to">
            <address className="text-sm not-italic text-muted">
              <span className="block text-fg">{a.fullName}</span>
              {a.line1}
              {a.line2 && <>, {a.line2}</>}
              <br />
              {a.city}, {a.province} {a.postalCode}
              <br />
              Philippines
            </address>
            <p className="mt-3 text-xs text-subtle">
              {SHIPPING_RATES[o.shippingTier].label} delivery
              {o.etaFrom && o.etaTo ? ` · ETA ${formatDate(o.etaFrom, { month: "short", day: "numeric" })} to ${formatDate(o.etaTo, { month: "short", day: "numeric" })}` : ""}
            </p>
            {o.trackingNumber && (
              <p className="mt-2 text-sm">
                {o.carrier} · <span className="select-all font-mono">{o.trackingNumber}</span>
              </p>
            )}
            {o.giftWrap && (
              <p className="mt-3 flex gap-2 rounded-md bg-accent/10 p-3 text-sm text-accent">
                <Gift className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>Gift wrap{o.giftNote ? `: “${o.giftNote}”` : ""}</span>
              </p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
