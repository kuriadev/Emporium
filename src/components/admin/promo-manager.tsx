"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Banknote, CalendarClock, Copy, Pencil, Percent, Plus, Shuffle, TicketPercent, Truck, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { formatDate, formatMoney } from "@/lib/money";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_RATES } from "@/lib/pricing";
import { PROMO_STATUS_LABEL, PROMO_STATUS_TONE, fromManilaInput, promoStatus, promoValueLabel, toManilaInput, type PromoType } from "@/lib/promo-status";
import { cn } from "@/lib/utils";
import { promoInputSchema, type PromoData, type PromoInput } from "@/lib/validations/admin";
import { savePromoAction, setPromoActiveAction } from "@/server/actions/admin";
import { EmptyState } from "./ui";

export interface PromoRow {
  id: string;
  code: string;
  description: string;
  type: PromoType;
  value: number;
  minSubtotal: number;
  startsAt: number | null;
  endsAt: number | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  usedCount: number;
  stackable: boolean;
  active: boolean;
  orders: number;
  revenue: number;
  discount: number;
}

const TYPES: { value: PromoType; label: string; icon: LucideIcon; fallback: string }[] = [
  { value: "percent", label: "Percent off", icon: Percent, fallback: "10" },
  { value: "fixed", label: "Amount off", icon: Banknote, fallback: "200" },
  { value: "free_shipping", label: "Free shipping", icon: Truck, fallback: "0" },
];

const DAY = 86_400_000;
/** Manila wall time `days` from now at 23:59. */
const endOfDayIn = (days: number) => `${toManilaInput(Date.now() + days * DAY).slice(0, 10)}T23:59`;

const blank = (): PromoInput => ({
  code: "",
  description: "",
  type: "percent",
  value: "10",
  minSubtotal: "0",
  startsAt: "",
  endsAt: endOfDayIn(14),
  usageLimit: "",
  perUserLimit: "1",
  stackable: false,
  active: true,
});

/** Realistic quick-fill campaigns: one tap fills every field, staff tweak from there. */
const PRESETS: { label: string; values: () => Partial<PromoInput> }[] = [
  { label: "Payday 15% off ₱2,000+", values: () => ({ code: "PAYDAY15", description: "15% off ₱2,000+ this payday weekend", type: "percent", value: "15", minSubtotal: "2000", startsAt: "", endsAt: endOfDayIn(3), usageLimit: "300", perUserLimit: "1", stackable: false }) },
  { label: "Free shipping weekend", values: () => ({ code: "SHIPFREE", description: "Free standard shipping this weekend, stacks with one other code", type: "free_shipping", value: "0", minSubtotal: "0", startsAt: "", endsAt: endOfDayIn(2), usageLimit: "", perUserLimit: "", stackable: true }) },
  { label: "₱300 off ₱3,000+", values: () => ({ code: "TAKE300", description: "₱300 off orders of ₱3,000 or more", type: "fixed", value: "300", minSubtotal: "3000", startsAt: "", endsAt: endOfDayIn(30), usageLimit: "500", perUserLimit: "1", stackable: false }) },
  { label: "VIP thank-you 20%", values: () => ({ code: "VIPTHANKS20", description: "20% off for our most loyal customers", type: "percent", value: "20", minSubtotal: "0", startsAt: "", endsAt: endOfDayIn(30), usageLimit: "50", perUserLimit: "1", stackable: false }) },
];

const randomCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I, easy to read aloud
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `EM${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
};

const toForm = (p: PromoRow): PromoInput => ({
  id: p.id,
  code: p.code,
  description: p.description,
  type: p.type,
  value: p.type === "fixed" ? String(p.value / 100) : p.type === "percent" ? String(p.value) : "0",
  minSubtotal: String(p.minSubtotal / 100),
  startsAt: toManilaInput(p.startsAt),
  endsAt: toManilaInput(p.endsAt),
  usageLimit: p.usageLimit ? String(p.usageLimit) : "",
  perUserLimit: p.perUserLimit ? String(p.perUserLimit) : "",
  stackable: p.stackable,
  active: p.active,
});

const shortDate = (ms: number) => formatDate(ms, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

function windowLabel(p: PromoRow, now: number): string {
  if (p.startsAt && p.startsAt > now) return `Starts ${shortDate(p.startsAt)}`;
  if (p.endsAt && p.endsAt < now) return `Ended ${shortDate(p.endsAt)}`;
  if (p.endsAt) return `Ends ${shortDate(p.endsAt)}`;
  return "No end date";
}

export function PromoManager({ promos, startOpen, toolbar }: { promos: PromoRow[]; startOpen: boolean; toolbar?: React.ReactNode }) {
  const router = useRouter();
  const [editing, setEditing] = useState<PromoRow | "new" | null>(startOpen ? "new" : null);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [now] = useState(() => Date.now());

  const close = () => {
    setEditing(null);
    if (startOpen) router.replace("/admin/promotions", { scroll: false });
  };

  const toggle = async (p: PromoRow, next: boolean, undoable = true) => {
    setOverrides((o) => ({ ...o, [p.id]: next }));
    const res = await setPromoActiveAction(p.id, next);
    if (!res.ok) {
      setOverrides(({ [p.id]: _rolledBack, ...rest }) => rest);
      toast.error(res.error);
      return;
    }
    toast.success(res.message ?? "Promotion updated", undoable ? { action: { label: "Undo", onClick: () => void toggle(p, !next, false) } } : undefined);
    router.refresh();
  };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`Copied ${code}`);
    } catch {
      toast.error("Couldn't copy. Select the code and copy it manually.");
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">{toolbar}</div>
        <Button size="sm" className="self-start sm:self-auto" onClick={() => setEditing("new")}>
          <Plus className="size-4" aria-hidden /> New promo code
        </Button>
      </div>

      {promos.length === 0 ? (
        <EmptyState icon={<TicketPercent className="size-7" />} title="No codes here">
          Create a code, or pick another filter.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {promos.map((p) => {
            const active = overrides[p.id] ?? p.active;
            const status = promoStatus({ ...p, active }, now);
            const used = p.usageLimit ? Math.min(1, p.usedCount / p.usageLimit) : 0;
            return (
              <li key={p.id} className={cn("flex min-w-0 flex-col rounded-lg border bg-surface/60 p-4 sm:p-5", status === "live" ? "border-line-strong" : "border-line")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1">
                      <span className="truncate font-mono text-lg tracking-wider">{p.code}</span>
                      <button type="button" onClick={() => void copy(p.code)} aria-label={`Copy ${p.code}`} className="grid size-9 shrink-0 place-items-center rounded-full text-subtle transition hover:bg-white/10 hover:text-fg pointer-coarse:size-tap">
                        <Copy className="size-3.5" />
                      </button>
                    </p>
                    <p className="text-sm text-accent">{promoValueLabel(p.type, p.value)}</p>
                  </div>
                  <Badge tone={PROMO_STATUS_TONE[status]}>{PROMO_STATUS_LABEL[status]}</Badge>
                </div>
                {p.description && <p className="mt-2 text-sm text-muted">{p.description}</p>}

                <ul className="mt-3 flex flex-wrap gap-1.5 text-xs text-muted">
                  <li className="rounded-pill border border-line px-2.5 py-1">{p.minSubtotal ? `Min. spend ${formatMoney(p.minSubtotal)}` : "No minimum"}</li>
                  <li className="rounded-pill border border-line px-2.5 py-1">{p.perUserLimit ? `${p.perUserLimit} per customer` : "Unlimited per customer"}</li>
                  <li className="rounded-pill border border-line px-2.5 py-1">{p.stackable ? "Stacks with another code" : "Can't be combined"}</li>
                </ul>

                <p className="mt-3 flex items-center gap-1.5 text-xs text-subtle">
                  <CalendarClock className="size-3.5" aria-hidden />
                  {windowLabel(p, now)}
                </p>

                <div className="mt-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted">{p.usageLimit ? `${p.usedCount} of ${p.usageLimit} redeemed` : `${p.usedCount} redeemed`}</span>
                    {!p.usageLimit && <span className="text-subtle">No cap</span>}
                  </div>
                  {p.usageLimit ? (
                    <div className="mt-1.5 h-[0.375rem] rounded-pill bg-white/[0.06]" role="meter" aria-valuemin={0} aria-valuemax={p.usageLimit} aria-valuenow={p.usedCount} aria-label={`${p.code} redemptions`}>
                      <div className={cn("h-full rounded-pill", used >= 1 ? "bg-subtle" : used >= 0.8 ? "bg-warning" : "bg-[#b174d4]")} style={{ width: `${Math.max(used * 100, p.usedCount ? 2 : 0)}%` }} />
                    </div>
                  ) : null}
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-sm">
                  <div>
                    <dt className="text-2xs text-subtle">Paid orders</dt>
                    <dd className="tabular-nums">{p.orders}</dd>
                  </div>
                  <div>
                    <dt className="text-2xs text-subtle">Revenue</dt>
                    <dd className="tabular-nums">{formatMoney(p.revenue)}</dd>
                  </div>
                  <div>
                    <dt className="text-2xs text-subtle">Discount given</dt>
                    <dd className="tabular-nums">{formatMoney(p.discount)}</dd>
                  </div>
                </dl>

                <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                  <label className="relative flex min-h-tap cursor-pointer items-center gap-3 text-sm">
                    <input type="checkbox" role="switch" checked={active} onChange={(e) => void toggle(p, e.target.checked)} className="peer sr-only" />
                    <span aria-hidden className="relative h-6 w-11 shrink-0 rounded-pill border border-line-strong bg-white/5 transition-colors peer-checked:border-success peer-checked:bg-success/25 peer-focus-visible:ring-[0.1875rem] peer-focus-visible:ring-accent">
                      <motion.span layout transition={{ type: "spring", stiffness: 600, damping: 34 }} className={cn("absolute top-[0.1875rem] size-4 rounded-full", active ? "right-[0.1875rem] bg-success" : "left-[0.1875rem] bg-muted")} />
                    </span>
                    <span className={active ? "text-fg" : "text-muted"}>{active ? "Enabled" : "Paused"}</span>
                  </label>
                  <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                    <Pencil className="size-4" aria-hidden /> Edit
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={editing !== null}
        onOpenChange={(o) => (o ? null : close())}
        title={editing === "new" ? "New promo code" : `Edit ${editing?.code ?? ""}`}
        description="Shoppers enter codes at checkout. Up to two codes per order, and only one that can't be combined."
        placement="top"
        className="max-w-[46rem]"
      >
        {editing !== null && <PromoForm key={editing === "new" ? "new" : editing.id} initial={editing === "new" ? null : editing} onDone={close} />}
      </Modal>
    </>
  );
}

function PromoForm({ initial, onDone }: { initial: PromoRow | null; onDone: () => void }) {
  const router = useRouter();
  const form = useForm<PromoInput, unknown, PromoData>({ resolver: zodResolver(promoInputSchema), defaultValues: initial ? toForm(initial) : blank(), mode: "onTouched" });
  const { control, register, formState, setValue, getValues, setError } = form;
  const { errors, isSubmitting, submitCount } = formState;
  const [type, value, minSubtotal] = useWatch({ control, name: ["type", "value", "minSubtotal"] });

  const applyPreset = (values: Partial<PromoInput>) => {
    for (const [k, v] of Object.entries(values)) setValue(k as keyof PromoInput, v as never, { shouldDirty: true, shouldValidate: true });
  };

  // Send the raw form values: the server runs the same schema (pesos → centavos) exactly once.
  const onSubmit = form.handleSubmit(async () => {
    const raw = getValues();
    const res = await savePromoAction({ ...raw, startsAt: fromManilaInput(String(raw.startsAt ?? "")), endsAt: fromManilaInput(String(raw.endsAt ?? "")) });
    if (!res.ok) {
      for (const [k, message] of Object.entries(res.fieldErrors ?? {})) setError(k as keyof PromoInput, { message });
      toast.error(res.error);
      return;
    }
    toast.success(res.message ?? "Saved", { description: "Recorded in the audit log." });
    onDone();
    router.refresh();
  });

  const pct = Number(value);
  const minPesos = Number(minSubtotal) || 0;
  const exampleBag = Math.max(minPesos, 3000) * 100;
  const saving = type === "percent" ? Math.round((exampleBag * (Number.isFinite(pct) ? pct : 0)) / 100) : type === "fixed" ? Math.min(Math.round((Number(value) || 0) * 100), exampleBag) : 0;

  return (
    <form noValidate onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-5">
      {!initial && (
        <div>
          <p className="mb-2 text-xs text-subtle">Quick start</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button key={p.label} type="button" onClick={() => applyPreset(p.values())} className="min-h-[2.25rem] rounded-pill border border-dashed border-line-strong px-3 text-xs text-muted transition hover:border-fg hover:text-fg active:scale-95 pointer-coarse:min-h-tap">
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        <Controller
          control={control}
          name="code"
          render={({ field }) => (
            <Field
              label="Code"
              required
              value={String(field.value ?? "")}
              onBlur={field.onBlur}
              onChange={(e) => field.onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20))}
              maxLength={20}
              autoComplete="off"
              spellCheck={false}
              className="font-mono tracking-wider"
              error={errors.code?.message}
              hint="3–20 letters or numbers. Shoppers type this at checkout."
              shakeKey={submitCount}
              suffix={
                <button type="button" onClick={() => setValue("code", randomCode(), { shouldDirty: true, shouldValidate: true })} className="-mr-2 flex min-h-[2.25rem] items-center gap-1.5 rounded-pill px-2.5 text-xs text-muted transition hover:bg-white/10 hover:text-fg pointer-coarse:min-h-tap">
                  <Shuffle className="size-3.5" aria-hidden /> Generate
                </button>
              }
            />
          )}
        />
        <Field label="Description" {...register("description")} maxLength={160} showCounter error={errors.description?.message} hint="Shown to shoppers when the code applies." shakeKey={submitCount} />
      </div>

      <div>
        <p className="mb-2 text-sm" id="promo-type-label">
          Discount type
        </p>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <div role="radiogroup" aria-labelledby="promo-type-label" className="isolate grid grid-cols-3 gap-1 rounded-md border border-line p-1">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={field.value === t.value}
                  onClick={() => {
                    if (field.value === t.value) return;
                    field.onChange(t.value);
                    setValue("value", t.fallback, { shouldValidate: submitCount > 0 });
                  }}
                  className={cn("relative flex min-h-tap flex-col items-center justify-center gap-1 rounded-sm px-1 py-1.5 text-xs transition-colors sm:flex-row sm:gap-2 sm:px-2 sm:text-sm", field.value === t.value ? "text-bg" : "text-muted hover:text-fg")}
                >
                  {field.value === t.value && <motion.span layoutId="promo-type-pill" className="absolute inset-0 -z-10 rounded-sm bg-fg" transition={{ type: "spring", stiffness: 520, damping: 36 }} />}
                  <t.icon className="size-4 shrink-0" aria-hidden />
                  <span className="text-center leading-tight">{t.label}</span>
                </button>
              ))}
            </div>
          )}
        />
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        {type === "free_shipping" ? (
          <p className="mb-5 self-center rounded-md border border-line bg-surface/70 p-3 text-sm text-muted">
            Waives the {formatMoney(SHIPPING_RATES.standard.fee)} standard fee. Orders over {formatMoney(FREE_SHIPPING_THRESHOLD)} already ship free, so this matters most for smaller bags.
          </p>
        ) : (
          <Field
            label={type === "percent" ? "Percent off" : "Amount off"}
            required
            inputMode="decimal"
            prefix={type === "fixed" ? "₱" : undefined}
            suffix={type === "percent" ? "%" : undefined}
            {...register("value")}
            error={errors.value?.message}
            hint={type === "percent" && pct > 50 ? "Over 50% off. Double-check your margins." : type === "percent" ? "1 to 90." : "Never more than the bag's value."}
            shakeKey={submitCount}
          />
        )}
        <Field label="Minimum spend" inputMode="decimal" prefix="₱" {...register("minSubtotal")} error={errors.minSubtotal?.message} hint="Before discounts. 0 for no minimum." shakeKey={submitCount} />
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        <Field label="Starts" type="datetime-local" {...register("startsAt")} error={errors.startsAt?.message} hint="Manila time. Blank starts now." shakeKey={submitCount} />
        <Field label="Ends" type="datetime-local" {...register("endsAt")} error={errors.endsAt?.message} hint="Blank runs until you pause it." shakeKey={submitCount} />
        <Field label="Total redemptions" inputMode="numeric" {...register("usageLimit")} error={errors.usageLimit?.message} hint="Blank for no cap." shakeKey={submitCount} />
        <Field label="Per customer" inputMode="numeric" {...register("perUserLimit")} error={errors.perUserLimit?.message} hint="Needs sign-in to redeem. Blank for no limit." shakeKey={submitCount} />
      </div>

      <div className="space-y-1 rounded-md border border-line p-3">
        <label className="flex min-h-tap cursor-pointer items-center justify-between gap-3 text-sm">
          <span>
            Can be combined
            <span className="block text-xs text-subtle">Works alongside one other code in the same order.</span>
          </span>
          <input type="checkbox" {...register("stackable")} className="size-5 accent-[var(--color-accent)]" />
        </label>
        <label className="flex min-h-tap cursor-pointer items-center justify-between gap-3 text-sm">
          <span>
            Active
            <span className="block text-xs text-subtle">Turn off to pause the code without deleting its history.</span>
          </span>
          <input type="checkbox" {...register("active")} className="size-5 accent-[var(--color-accent)]" />
        </label>
      </div>

      <p className="rounded-md bg-accent/10 p-3 text-sm text-accent" aria-live="polite">
        {type === "free_shipping"
          ? `Preview: a ${formatMoney(exampleBag)} bag ships free with this code.`
          : saving > 0
            ? `Preview: on a ${formatMoney(exampleBag)} bag, shoppers save ${formatMoney(saving)} and pay ${formatMoney(exampleBag - saving)} before shipping.`
            : "Preview: enter a discount to see what shoppers save."}
      </p>

      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" loading={isSubmitting}>
          {initial ? "Save changes" : "Create code"}
        </Button>
      </div>
    </form>
  );
}
