import { Heart, Mail, MapPin, Phone, ShoppingBag, Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditDiff } from "@/components/admin/audit-diff";
import { CustomerNotes, CustomerStatusControl } from "@/components/admin/customer-controls";
import { EmptyState, OrderStatusBadge, PageHeader, Panel, StatTile, peso } from "@/components/admin/ui";
import { Badge } from "@/components/ui/bits";
import { buttonVariants } from "@/components/ui/button-variants";
import { formatDate, formatMoney, formatRelative } from "@/lib/money";
import type { OrderStatusValue } from "@/lib/order-state";
import { cn } from "@/lib/utils";
import { requestTime } from "@/lib/clock";
import { requireAdminPage } from "@/server/auth/guards";
import { can } from "@/server/auth/permissions";
import { getAdminCustomer } from "@/server/services/admin";

// Keep shopper names out of browser history and tab titles on shared staff machines.
export const metadata: Metadata = { title: "Customer profile" };

type Props = { params: Promise<{ id: string }> };
const validId = (id: string) => /^[A-Za-z0-9-]{1,64}$/.test(id);
const CATEGORY_LABEL: Record<string, string> = { gadgets: "Gadgets", furniture: "Furniture", accessories: "Accessories", clothes: "Clothes" };
const dt = (d: Date | number) => formatDate(d, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });

export default async function AdminCustomerPage({ params }: Props) {
  const { id } = await params;
  const admin = await requireAdminPage("customers:view", `/admin/customers/${encodeURIComponent(id)}`);
  if (!validId(id)) notFound();
  const data = getAdminCustomer(id);
  if (!data) notFound();
  const { customer: c, addresses, orders, categories, cart, wishlist, reviews, refunds, audit } = data;
  const now = requestTime();
  const canOrders = can(admin.adminRole, "orders:view");
  const categorySpend = categories.reduce((n, x) => n + x.spend, 0);

  return (
    <>
      <PageHeader
        eyebrow={`Customer since ${formatDate(c.createdAt, { month: "long", year: "numeric" })}`}
        title={c.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {c.status === "suspended" ? <Badge tone="danger">Suspended</Badge> : <Badge tone="success">Active</Badge>}
            {c.paidOrders >= 2 && <Badge tone="accent">Repeat buyer</Badge>}
            <Link href="/admin/customers" className="text-accent hover:underline">
              All customers
            </Link>
          </span>
        }
        actions={
          <a href={`mailto:${c.email}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Mail className="size-4" aria-hidden /> Email customer
          </a>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Lifetime value" value={peso(c.ltv)} hint="Paid orders minus refunds" />
        <StatTile label="Orders" value={c.orders} hint={refunds ? `${refunds} refunded` : `${c.paidOrders} paid`} />
        <StatTile label="Average order" value={c.aov ? peso(c.aov) : "–"} hint="Per paid order" />
        <StatTile label="Last order" value={c.lastOrder ? formatRelative(c.lastOrder, now) : "None yet"} hint={c.lastOrder ? formatDate(c.lastOrder) : "Hasn't checked out yet"} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-4">
          <Panel id="orders" title="Order history" description={orders.length >= 25 ? "Latest 25 orders" : undefined}>
            {orders.length === 0 ? (
              <EmptyState icon={<ShoppingBag className="size-7" />} title="No orders yet">
                {cart.units ? `They have ${cart.units} ${cart.units === 1 ? "item" : "items"} worth ${formatMoney(cart.value)} waiting in their bag.` : "Nothing in their bag either."}
              </EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {orders.map((o) => {
                  const badges = (
                    <>
                      <OrderStatusBadge status={o.status as OrderStatusValue} />
                      {o.returnStatus === "requested" && <Badge tone="warning">Return</Badge>}
                    </>
                  );
                  const body = (
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-sm">{o.number}</span>
                        <span className="block text-xs text-subtle">
                          {formatDate(o.createdAt, { month: "short", day: "numeric", year: "numeric" })} · {o.items} {o.items === 1 ? "item" : "items"}
                        </span>
                        <span className="mt-1.5 flex flex-wrap gap-1.5 sm:hidden">{badges}</span>
                      </span>
                      <span className="hidden shrink-0 flex-wrap justify-end gap-1.5 sm:flex">{badges}</span>
                      <span className="w-[6.5rem] shrink-0 text-right text-sm tabular-nums">
                        {formatMoney(o.total)}
                        {o.refunded > 0 && <span className="block text-xs text-warning">−{formatMoney(o.refunded)}</span>}
                      </span>
                    </>
                  );
                  return (
                    <li key={o.id}>
                      {canOrders ? (
                        <Link href={`/admin/orders/${o.id}`} className="-mx-2 flex min-h-tap items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-white/[0.04]">
                          {body}
                        </Link>
                      ) : (
                        <div className="flex min-h-tap items-center gap-3 py-2.5">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel id="habits" title="What they buy" description="Share of paid spend by category">
              {categories.length === 0 ? (
                <p className="text-sm text-subtle">No paid orders yet.</p>
              ) : (
                <ul className="space-y-3" style={{ ["--viz-series" as string]: "#b174d4" }}>
                  {categories.map((x) => {
                    const share = categorySpend ? x.spend / categorySpend : 0;
                    return (
                      <li key={x.category}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span>{CATEGORY_LABEL[x.category] ?? x.category}</span>
                          <span className="tabular-nums text-muted">
                            {formatMoney(x.spend)} <span className="text-subtle">· {Math.round(share * 100)}%</span>
                          </span>
                        </div>
                        <div className="mt-1.5 h-[0.375rem] bg-white/[0.06]" aria-hidden>
                          <div className="h-full rounded-r-[0.25rem] bg-[var(--viz-series)]" style={{ width: `${Math.max(share * 100, 2)}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-subtle">
                          {x.units} {x.units === 1 ? "unit" : "units"}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            <Panel id="engagement" title="Engagement">
              <dl className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <ShoppingBag className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden />
                  <div>
                    <dt className="text-muted">In their bag</dt>
                    <dd>
                      {cart.units ? (
                        <>
                          {cart.units} {cart.units === 1 ? "item" : "items"} · {formatMoney(cart.value)}
                          {cart.updatedAt && <span className="block text-xs text-subtle">Last touched {formatRelative(cart.updatedAt, now)}</span>}
                        </>
                      ) : (
                        "Empty"
                      )}
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Heart className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden />
                  <div>
                    <dt className="text-muted">Wishlist</dt>
                    <dd>
                      {wishlist} {wishlist === 1 ? "product" : "products"}
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Star className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden />
                  <div>
                    <dt className="text-muted">Reviews written</dt>
                    <dd>{reviews.count ? `${reviews.count} · average ${reviews.average?.toFixed(1)} of 5` : "None yet"}</dd>
                  </div>
                </div>
              </dl>
            </Panel>
          </div>

          {audit.length > 0 && (
            <Panel id="audit" title="Staff changes" description="Every edit to this account, with before and after.">
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
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <Panel id="contact" title="Contact">
            <p className="flex items-center gap-2 text-sm">
              <Mail className="size-4 shrink-0 text-subtle" aria-hidden />
              <a href={`mailto:${c.email}`} className="truncate hover:underline">
                {c.email}
              </a>
            </p>
            {c.phone && (
              <p className="mt-2 flex items-center gap-2 text-sm">
                <Phone className="size-4 shrink-0 text-subtle" aria-hidden />
                <a href={`tel:${c.phone.replace(/[^+\d]/g, "")}`} className="hover:underline">
                  {c.phone}
                </a>
              </p>
            )}
          </Panel>

          <Panel id="notes" title="Notes">
            <CustomerNotes userId={c.id} initial={c.notes} canEdit={can(admin.adminRole, "customers:notes")} />
          </Panel>

          <Panel id="addresses" title="Saved addresses">
            {addresses.length === 0 ? (
              <p className="text-sm text-subtle">No saved addresses.</p>
            ) : (
              <ul className="space-y-3">
                {addresses.map((a) => (
                  <li key={a.id} className={cn("rounded-md border p-3 text-sm", a.isDefault ? "border-line-strong" : "border-line")}>
                    <p className="flex items-center gap-2">
                      <MapPin className="size-3.5 text-subtle" aria-hidden />
                      {a.label}
                      {a.isDefault && <Badge>Default</Badge>}
                    </p>
                    <address className="mt-1 not-italic text-muted">
                      {a.fullName}
                      <br />
                      {a.line1}
                      {a.line2 && <>, {a.line2}</>}
                      <br />
                      {a.city}, {a.province} {a.postalCode}
                    </address>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {can(admin.adminRole, "customers:manage") && (
            <Panel id="access" title="Account access">
              <CustomerStatusControl userId={c.id} name={c.name} status={c.status} />
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
