import { Check, Package, Truck } from "lucide-react";
import { requestTime } from "@/lib/clock";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LottieSuccess } from "@/components/motion/lottie-success";
import { OrderActions } from "@/components/store/order-actions";
import { Badge } from "@/components/ui/bits";
import { formatDate, formatMoney } from "@/lib/money";
import { CUSTOMER_CANCELLABLE, ORDER_FLOW, RETURN_WINDOW_DAYS, STATUS_LABEL, type OrderStatusValue } from "@/lib/order-state";
import { SHIPPING_RATES } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { requireUserPage } from "@/server/auth/guards";
import { getOrderForViewer } from "@/server/services/orders";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ placed?: string }> };

export const metadata: Metadata = { title: "Order details", robots: { index: false } };

const TONE: Record<OrderStatusValue, "neutral" | "success" | "warning" | "danger" | "accent"> = {
  pending: "warning",
  paid: "accent",
  packed: "accent",
  shipped: "accent",
  delivered: "success",
  cancelled: "danger",
  refunded: "neutral",
};

const dt = (d: Date) => formatDate(d, { dateStyle: "medium", timeStyle: "short" });

export default async function OrderPage({ params, searchParams }: Props) {
  const { id } = await params;
  const user = await requireUserPage(`/orders/${encodeURIComponent(id)}`);
  if (!/^[A-Za-z0-9-]{1,64}$/.test(id)) notFound();
  const data = getOrderForViewer(id, user);
  // 404 rather than 403 for someone else's order: no hint that the id exists.
  if (!data) notFound();
  const { order, items, events } = data;
  const placed = (await searchParams).placed === "1";
  const status = order.status as OrderStatusValue;
  const reached = new Map<string, Date>();
  for (const e of events) if (!reached.has(e.status)) reached.set(e.status, e.createdAt);
  const flowIndex = ORDER_FLOW.indexOf(status);
  const terminal = status === "cancelled" || status === "refunded";
  const canCancel = user.role === "customer" && CUSTOMER_CANCELLABLE.includes(status);
  const withinWindow = requestTime() - order.updatedAt.getTime() <= RETURN_WINDOW_DAYS * 86_400_000;
  const canReturn = user.role === "customer" && status === "delivered" && order.returnStatus === "none" && withinWindow;
  const a = order.shippingAddress;

  return (
    <div className="shell space-y-8 pb-36 pt-8 lg:pb-section lg:pt-12">
      {placed && (
        <section className="no-print flex flex-col items-center gap-3 rounded-xl border border-success/40 bg-success/5 p-8 text-center" aria-live="polite">
          <LottieSuccess className="size-28" label="Order placed" />
          <h1 className="text-3xl font-light">Thank you, {user.name.split(" ")[0]}!</h1>
          <p className="max-w-[32rem] text-muted">
            Order <span className="text-fg">{order.number}</span> is confirmed. A receipt is on its way to {order.email}.
            {order.etaFrom && order.etaTo && (
              <>
                {" "}
                Estimated delivery: {formatDate(order.etaFrom, { weekday: "short", month: "short", day: "numeric" })} to {formatDate(order.etaTo, { weekday: "short", month: "short", day: "numeric" })}.
              </>
            )}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/products" className="inline-flex min-h-tap items-center rounded-pill border border-line-strong px-5 text-sm hover:border-fg">
              Keep shopping
            </Link>
            <Link href="/account" className="inline-flex min-h-tap items-center rounded-pill bg-fg px-5 text-sm text-bg">
              View all orders
            </Link>
          </div>
        </section>
      )}

      <article className="print-sheet space-y-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="no-print text-sm text-subtle">
              <Link href="/account" className="hover:text-fg">
                Account
              </Link>{" "}
              / Orders
            </p>
            {placed ? <h2 className="mt-1 text-3xl font-light">Order {order.number}</h2> : <h1 className="mt-1 text-3xl font-light">Order {order.number}</h1>}
            <p className="mt-1 text-sm text-muted">Placed {dt(order.createdAt)}</p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge tone={TONE[status]}>{STATUS_LABEL[status]}</Badge>
              {order.returnStatus !== "none" && <Badge tone="warning">Return {order.returnStatus}</Badge>}
            </div>
            <OrderActions orderId={order.id} canCancel={canCancel} canReturn={canReturn} />
          </div>
        </header>

        <section aria-labelledby="timeline-title" className="rounded-xl border border-line p-5 sm:p-6">
          <h2 id="timeline-title" className="mb-5 text-lg">
            Fulfilment
          </h2>
          {terminal ? (
            <p className="text-sm text-muted">
              This order was {status}
              {reached.get(status) && ` on ${dt(reached.get(status)!)}`}.{order.refundedAmount > 0 && ` ${formatMoney(order.refundedAmount)} refunded to your original payment method.`}
            </p>
          ) : (
            <ol className="grid gap-4 sm:grid-cols-5">
              {ORDER_FLOW.map((s, i) => {
                const done = i <= flowIndex;
                const at = reached.get(s);
                return (
                  <li key={s} className="relative flex gap-3 sm:flex-col sm:gap-2">
                    {i < ORDER_FLOW.length - 1 && <span aria-hidden className={cn("absolute left-[0.9375rem] top-8 h-[calc(100%-1rem)] w-px sm:left-8 sm:top-[0.9375rem] sm:h-px sm:w-[calc(100%-1rem)]", i < flowIndex ? "bg-success" : "bg-line")} />}
                    <span className={cn("relative z-10 grid size-8 shrink-0 place-items-center rounded-full border text-xs", done ? "border-success bg-success text-bg" : "border-line-strong text-muted")}>
                      {done ? <Check className="size-4" aria-hidden /> : i + 1}
                    </span>
                    <span>
                      <span className={cn("block text-sm", done ? "text-fg" : "text-muted")}>{STATUS_LABEL[s]}</span>
                      <span className="block text-xs text-subtle">{at ? dt(at) : s === "delivered" && order.etaTo ? `ETA ${formatDate(order.etaTo, { month: "short", day: "numeric" })}` : ""}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
          {order.trackingNumber && (
            <p className="mt-5 flex flex-wrap items-center gap-2 rounded-md bg-surface/60 p-3 text-sm">
              <Truck className="size-4 text-price" aria-hidden />
              {order.carrier ?? "Courier"} tracking number: <span className="select-all font-mono">{order.trackingNumber}</span>
            </p>
          )}
          <details className="no-print mt-5 text-sm">
            <summary className="cursor-pointer text-muted hover:text-fg">Full history ({events.length})</summary>
            <ol className="mt-3 space-y-2 border-l border-line pl-4">
              {events.map((e) => (
                <li key={e.id}>
                  <span className="text-fg">{e.status.replace(/_/g, " ")}</span> <span className="text-xs text-subtle">· {dt(e.createdAt)}</span>
                  {e.note && <span className="block text-muted">{e.note}</span>}
                </li>
              ))}
            </ol>
          </details>
        </section>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <section aria-labelledby="items-title">
            <h2 id="items-title" className="mb-3 text-lg">
              Items
            </h2>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {items.map((it) => (
                <li key={it.id} className="flex items-center gap-4 p-4">
                  <span className="relative size-16 shrink-0 overflow-hidden rounded-sm bg-white">{it.image ? <Image src={it.image} alt="" fill sizes="4rem" className="object-cover" /> : <Package className="m-auto size-6 text-bg" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block">{it.name}</span>
                    <span className="block text-xs text-muted">
                      {it.variantLabel} · SKU {it.sku}
                    </span>
                    <span className="block text-xs text-muted">
                      {it.quantity} × {formatMoney(it.unitPrice)}
                    </span>
                  </span>
                  <span className="tabular-nums">{formatMoney(it.lineTotal)}</span>
                </li>
              ))}
            </ul>
          </section>

          <aside className="space-y-6">
            <section aria-labelledby="pay-title" className="rounded-xl border border-line p-5">
              <h2 id="pay-title" className="mb-3 text-lg">
                Payment
              </h2>
              <dl className="space-y-2 text-sm">
                {[
                  ["Subtotal", order.subtotal],
                  ["Volume pricing", -order.tierDiscount],
                  ["Bundle savings", -order.bundleDiscount],
                  [`Promo${order.promoCodes.length ? ` (${order.promoCodes.join(", ")})` : ""}`, -order.promoDiscount],
                  [`Shipping · ${SHIPPING_RATES[order.shippingTier].label}`, order.shippingFee],
                  ["Gift wrap", order.giftWrapFee],
                ]
                  .filter(([, v], i) => i === 0 || i === 4 || v !== 0)
                  .map(([label, v]) => (
                    <div key={label as string} className={cn("flex justify-between gap-4", (v as number) < 0 ? "text-price" : "text-muted")}>
                      <dt>{label}</dt>
                      <dd className="tabular-nums">{(v as number) < 0 ? `−${formatMoney(-(v as number))}` : (v as number) === 0 ? "Free" : formatMoney(v as number)}</dd>
                    </div>
                  ))}
                <div className="flex justify-between gap-4 border-t border-line pt-2 text-base text-fg">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{formatMoney(order.total)}</dd>
                </div>
                {order.refundedAmount > 0 && (
                  <div className="flex justify-between gap-4 text-warning">
                    <dt>Refunded</dt>
                    <dd className="tabular-nums">−{formatMoney(order.refundedAmount)}</dd>
                  </div>
                )}
                <p className="text-xs text-subtle">Includes {formatMoney(order.taxIncluded)} VAT (12%).</p>
                <p className="text-xs text-subtle">Paid with {order.paymentMethod === "card" ? `card ending ${order.paymentLast4}` : order.paymentMethod === "gcash" ? `GCash ending ${order.paymentLast4 ?? ""}` : "cash on delivery"}.</p>
              </dl>
            </section>
            <section aria-labelledby="ship-title" className="rounded-xl border border-line p-5 text-sm">
              <h2 id="ship-title" className="mb-3 text-lg">
                Ship to
              </h2>
              <address className="not-italic text-muted">
                <span className="block text-fg">{a.fullName}</span>
                {a.line1}
                {a.line2 && <>, {a.line2}</>}
                <br />
                {a.city}, {a.province} {a.postalCode}
                <br />
                Philippines · {a.phone}
              </address>
              {order.giftWrap && <p className="mt-3 rounded-md bg-accent/10 p-3 text-accent">Gift wrapped{order.giftNote ? `: “${order.giftNote}”` : ""}</p>}
            </section>
            <p className="no-print text-sm text-muted">
              Questions about this order?{" "}
              <Link href="/support" className="text-accent underline-offset-4 hover:underline">
                Contact support
              </Link>
            </p>
          </aside>
        </div>
      </article>
    </div>
  );
}
