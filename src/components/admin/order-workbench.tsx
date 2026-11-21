"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Ban, Boxes, CircleCheck, CreditCard, PackageCheck, Printer, RotateCcw, Truck, Undo2, X, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { formatMoney } from "@/lib/money";
import { ORDER_TRANSITIONS, STATUS_LABEL, type OrderStatusValue } from "@/lib/order-state";
import { cn } from "@/lib/utils";
import { rejectReturnAction, transitionOrderAction } from "@/server/actions/admin";

const CARRIERS = ["J&T Express", "LBC Express", "Ninja Van", "Flash Express", "Grab Express"] as const;
const TRACKING_PREFIX: Record<(typeof CARRIERS)[number], string> = { "J&T Express": "JT78", "LBC Express": "LBC", "Ninja Van": "NVPH", "Flash Express": "PH", "Grab Express": "GRB" };

const ACTION: Record<OrderStatusValue, { label: string; icon: LucideIcon; tone: "primary" | "outline" | "danger" }> = {
  pending: { label: "Pending", icon: CreditCard, tone: "outline" },
  paid: { label: "Mark as paid", icon: CreditCard, tone: "primary" },
  packed: { label: "Mark as packed", icon: Boxes, tone: "primary" },
  shipped: { label: "Ship with tracking", icon: Truck, tone: "primary" },
  delivered: { label: "Mark as delivered", icon: PackageCheck, tone: "primary" },
  cancelled: { label: "Cancel order", icon: Ban, tone: "danger" },
  refunded: { label: "Issue a refund", icon: RotateCcw, tone: "outline" },
};

const REASONS: Partial<Record<OrderStatusValue, string[]>> = {
  cancelled: ["Customer asked to cancel", "Payment not received within 48 hours", "Item out of stock", "Suspected fraud"],
  refunded: ["Return received in good condition", "Item arrived damaged", "Late delivery goodwill credit", "Wrong item sent"],
  paid: ["COD collected by courier", "Bank transfer confirmed"],
  packed: ["Packed and sealed, 1 box", "Gift wrapped and packed"],
  delivered: ["Courier confirmed delivery", "Customer confirmed receipt"],
};

export interface WorkbenchOrder {
  id: string;
  number: string;
  status: OrderStatusValue;
  returnStatus: string;
  returnReason: string | null;
  total: number;
  refunded: number;
  shippingFee: number;
}

/**
 * Order state machine controls. Only transitions allowed from the current status are offered, and
 * only the ones this role may perform; the server re-validates both before writing anything.
 */
export function OrderWorkbench({ order, canFulfill, canRefund }: { order: WorkbenchOrder; canFulfill: boolean; canRefund: boolean }) {
  const router = useRouter();
  const remaining = order.total - order.refunded;
  const allowed = ORDER_TRANSITIONS[order.status].filter((to) => (to === "refunded" ? canRefund && remaining > 0 : canFulfill));
  const [open, setOpen] = useState<OrderStatusValue | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [carrier, setCarrier] = useState<(typeof CARRIERS)[number]>("J&T Express");
  const [tracking, setTracking] = useState("");
  const [amount, setAmount] = useState((remaining / 100).toFixed(2));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const start = (to: OrderStatusValue | "reject", preset?: { note?: string; amount?: number }) => {
    setOpen(to);
    setErrors({});
    setNote(preset?.note ?? REASONS[to as OrderStatusValue]?.[0] ?? "");
    setAmount(((preset?.amount ?? remaining) / 100).toFixed(2));
    if (to === "shipped") setTracking(`${TRACKING_PREFIX[carrier]}${String(Date.now()).slice(-9)}`);
  };

  const submit = async () => {
    if (!open) return;
    setBusy(true);
    setAttempt((n) => n + 1);
    const res =
      open === "reject"
        ? await rejectReturnAction({ orderId: order.id, note })
        : await transitionOrderAction({ orderId: order.id, to: open, note, carrier: open === "shipped" ? carrier : "", trackingNumber: open === "shipped" ? tracking : "", refundAmount: open === "refunded" ? amount : undefined });
    setBusy(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast.error(res.error);
      return;
    }
    toast.success(res.message ?? "Order updated", { description: "Logged in the order timeline and audit log." });
    setOpen(null);
    router.refresh();
  };

  const amountNumber = Number(amount);
  const isPartial = open === "refunded" && Number.isFinite(amountNumber) && Math.round(amountNumber * 100) < remaining;

  return (
    <div className="space-y-4">
      {order.returnStatus === "requested" && (
        <div className="rounded-md border border-warning/50 bg-warning/10 p-4 text-sm">
          <p className="flex items-center gap-2 text-warning">
            <Undo2 className="size-4" aria-hidden /> Return requested
          </p>
          <p className="mt-1 text-muted">“{order.returnReason ?? "No reason given"}”</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {canRefund && remaining > 0 && (
              <Button size="sm" onClick={() => start("refunded", { note: `Return approved: ${order.returnReason ?? "customer return"}` })}>
                Approve and refund
              </Button>
            )}
            {canFulfill && (
              <Button size="sm" variant="outline" onClick={() => start("reject", { note: "Outside the condition requirements for returns" })}>
                Decline
              </Button>
            )}
          </div>
        </div>
      )}

      {allowed.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {allowed.map((to) => {
            const a = ACTION[to];
            return (
              <Button key={to} size="sm" variant={a.tone === "primary" ? "primary" : a.tone === "danger" ? "danger" : "outline"} className={cn("min-h-tap", open === to && "ring-2 ring-accent")} aria-expanded={open === to} onClick={() => (open === to ? setOpen(null) : start(to))}>
                <a.icon className="size-4" aria-hidden /> {a.label}
              </Button>
            );
          })}
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted">
          <CircleCheck className="size-4 text-success" aria-hidden />
          {order.status === "cancelled" || order.status === "refunded" ? `This order is ${order.status}. No further steps.` : canFulfill ? "Nothing to do right now." : "Your role can view this order but not change it."}
        </p>
      )}

      <AnimatePresence initial={false}>
        {open && (
          <motion.form
            key={open}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="overflow-hidden"
          >
            <div className="space-y-4 rounded-md border border-line-strong bg-surface/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm">
                  {open === "reject" ? "Decline the return request" : `${STATUS_LABEL[order.status]} → ${open === "refunded" && isPartial ? "Partial refund" : STATUS_LABEL[open]}`}
                </p>
                <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="grid size-9 place-items-center rounded-full text-muted hover:bg-white/10 hover:text-fg">
                  <X className="size-4" />
                </button>
              </div>

              {open === "shipped" && (
                <div className="grid gap-x-4 sm:grid-cols-2">
                  <Field
                    as="select"
                    label="Carrier"
                    value={carrier}
                    onChange={(e) => {
                      const c = e.target.value as (typeof CARRIERS)[number];
                      setCarrier(c);
                      setTracking(`${TRACKING_PREFIX[c]}${String(Date.now()).slice(-9)}`);
                    }}
                  >
                    {CARRIERS.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Field>
                  <Field
                    label="Tracking number"
                    required
                    value={tracking}
                    maxLength={40}
                    onChange={(e) => setTracking(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
                    error={errors.trackingNumber}
                    hint="Shown to the customer on their order page."
                    shakeKey={attempt}
                    className="font-mono"
                  />
                </div>
              )}

              {open === "refunded" && (
                <div>
                  <Field label="Refund amount" required prefix="₱" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, "").slice(0, 12))} error={errors.refundAmount} hint={`Up to ${formatMoney(remaining)} can still be refunded${order.refunded ? ` (${formatMoney(order.refunded)} already refunded)` : ""}.`} shakeKey={attempt} />
                  <div className="-mt-2 mb-2 flex flex-wrap gap-2">
                    {[
                      { label: "Full remaining", value: remaining },
                      { label: "Half", value: Math.round(remaining / 2) },
                      ...(order.shippingFee > 0 && order.shippingFee < remaining ? [{ label: "Shipping fee", value: order.shippingFee }] : []),
                    ].map((p) => (
                      <button key={p.label} type="button" onClick={() => setAmount((p.value / 100).toFixed(2))} className="min-h-[2.25rem] pointer-coarse:min-h-tap rounded-pill pointer-coarse:min-h-tap border border-dashed border-line-strong px-3 text-xs text-muted hover:border-fg hover:text-fg active:scale-95">
                        {p.label} · {formatMoney(p.value)}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-subtle">{isPartial ? "Partial refund: the order keeps its current status." : "Full refund: the order moves to Refunded. Unshipped stock goes back on the shelf."}</p>
                </div>
              )}

              {(REASONS[open as OrderStatusValue] || open === "reject") && (
                <div className="flex flex-wrap gap-2">
                  {(open === "reject" ? ["Outside the condition requirements for returns", "Return window has closed", "Item shows signs of use"] : REASONS[open as OrderStatusValue]!).map((r) => (
                    <button key={r} type="button" onClick={() => setNote(r)} aria-pressed={note === r} className={cn("min-h-[2.25rem] pointer-coarse:min-h-tap rounded-pill pointer-coarse:min-h-tap border px-3 text-xs transition active:scale-95", note === r ? "border-accent bg-accent/10 text-fg" : "border-line text-muted hover:border-line-strong hover:text-fg")}>
                      {r}
                    </button>
                  ))}
                </div>
              )}
              <Field
                label={open === "cancelled" || open === "refunded" || open === "reject" ? "Reason (required, shown in the audit log)" : "Note (optional)"}
                value={note}
                maxLength={240}
                showCounter
                onChange={(e) => setNote(e.target.value)}
                error={errors.note}
                shakeKey={attempt}
              />
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" className="min-h-tap" onClick={() => setOpen(null)}>
                  Back
                </Button>
                <Button type="submit" size="sm" variant={open === "cancelled" || open === "reject" ? "danger" : "primary"} className="min-h-tap" loading={busy}>
                  {open === "reject" ? "Decline return" : open === "refunded" ? `Refund ${Number.isFinite(amountNumber) ? formatMoney(Math.round(amountNumber * 100)) : ""}` : `Confirm: ${STATUS_LABEL[open]}`}
                </Button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PrintButton({ label = "Print packing slip" }: { label?: string }) {
  return (
    <Button variant="outline" size="sm" className="no-print" onClick={() => window.print()}>
      <Printer className="size-4" aria-hidden /> {label}
    </Button>
  );
}
