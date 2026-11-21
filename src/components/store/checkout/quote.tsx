"use client";

import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { Check, Gift, Tag, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Money } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { MAX_PROMO_CODES, type PricingResult } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { quoteAction, type CartQuote } from "@/server/actions/shop";
import { useCart } from "@/stores/cart";
import { useCheckoutOptions } from "@/stores/checkout";

/** Server-priced quote for the current bag + checkout options. Re-runs when lines or options change. */
export function useQuote() {
  const { promoCodes, shippingTier, giftWrap, setPromoCodes } = useCheckoutOptions();
  const signature = useCart((s) => s.cart?.lines.map((l) => `${l.variantId}:${l.quantity}`).join("|") ?? null);
  const [quote, setQuote] = useState<CartQuote | null>(null);
  // Loading is derived: true until the response for the current inputs has landed.
  const requestKey = JSON.stringify([signature, promoCodes, shippingTier, giftWrap]);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const loading = settledKey !== requestKey;

  useEffect(() => {
    if (signature === null) return;
    let alive = true;
    void quoteAction({ promoCodes, shippingTier, giftWrap }).then((res) => {
      if (!alive) return;
      setSettledKey(requestKey);
      if (!res.ok) return;
      setQuote(res.data);
      // Drop codes that stopped applying (expired, min spend no longer met) so checkout never submits them.
      const rejected = new Set(res.data.rejectedPromos.map((r) => r.code));
      if (promoCodes.some((c) => rejected.has(c))) setPromoCodes(promoCodes.filter((c) => !rejected.has(c)));
    });
    return () => {
      alive = false;
    };
  }, [signature, promoCodes, shippingTier, giftWrap, setPromoCodes, requestKey]);

  return { quote, loading };
}

const DEMO_CODES = ["WELCOME10", "SAVE100", "FREESHIP"];

export function PromoCodeInput({ quote }: { quote: CartQuote | null }) {
  const { promoCodes, shippingTier, giftWrap, setPromoCodes } = useCheckoutOptions();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [justApplied, setJustApplied] = useState<string | null>(null);
  const controls = useAnimationControls();
  const reduce = useReducedMotion();

  const apply = async (raw: string) => {
    const code = raw.trim().toUpperCase();
    setError(undefined);
    const fail = (msg: string) => {
      setError(msg);
      if (!reduce) void controls.start({ x: [0, -10, 9, -6, 4, 0], transition: { duration: 0.32 } });
    };
    if (!/^[A-Z0-9]{3,20}$/.test(code)) return fail("Codes are 3 to 20 letters or numbers.");
    if (promoCodes.includes(code)) return fail(`${code} is already applied.`);
    if (promoCodes.length >= MAX_PROMO_CODES) return fail(`You can use up to ${MAX_PROMO_CODES} codes per order.`);
    setBusy(true);
    const res = await quoteAction({ promoCodes: [...promoCodes, code], shippingTier, giftWrap });
    setBusy(false);
    if (!res.ok) return fail(res.error);
    const rejected = res.data.rejectedPromos.find((r) => r.code === code);
    if (rejected) return fail(rejected.reason);
    setPromoCodes([...promoCodes, code]);
    setValue("");
    setJustApplied(code);
    setTimeout(() => setJustApplied(null), 1200);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void apply(value);
  };

  const applied = quote?.totals.promos.filter((p) => p.applied) ?? [];

  return (
    <div className="space-y-3">
      <motion.form animate={controls} onSubmit={onSubmit} noValidate className="flex gap-2" aria-label="Promo code">
        <label className="sr-only" htmlFor="promo">
          Promo code
        </label>
        <div className={cn("flex min-h-tap flex-1 items-center gap-2 rounded-pill border bg-surface/70 px-4 transition-[border-color,box-shadow] duration-200 focus-within:border-accent focus-within:shadow-[0_0_0_0.3125rem_oklch(0.78_0.11_315/0.28)]", error ? "border-danger bg-danger/10" : "border-line")}>
          <Tag className="size-4 shrink-0 text-muted" aria-hidden />
          <input
            id="promo"
            value={value}
            onChange={(e) => {
              setValue(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20));
              setError(undefined);
            }}
            placeholder="Promo code"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={!!error}
            aria-describedby="promo-msg"
            className="min-w-0 flex-1 bg-transparent uppercase tracking-wider outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-subtle"
          />
        </div>
        <Button type="submit" variant="outline" loading={busy} disabled={!value}>
          Apply
        </Button>
      </motion.form>
      <p id="promo-msg" role={error ? "alert" : undefined} className={cn("min-h-[1.25rem] text-sm", error ? "text-danger" : "text-subtle")}>
        {error ?? (promoCodes.length < MAX_PROMO_CODES ? "Stack up to two codes when both allow it." : "Maximum codes applied.")}
      </p>
      {promoCodes.length < MAX_PROMO_CODES && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-subtle">
          <span>Sandbox codes:</span>
          {DEMO_CODES.filter((c) => !promoCodes.includes(c)).map((c) => (
            <button key={c} type="button" onClick={() => void apply(c)} className="min-h-[2rem] pointer-coarse:min-h-tap rounded-pill border border-dashed border-line-strong px-2.5 font-mono tracking-wider text-muted transition hover:border-fg hover:text-fg active:scale-95">
              {c}
            </button>
          ))}
        </div>
      )}
      <ul className="flex flex-wrap gap-2" aria-label="Applied codes">
        <AnimatePresence initial={false}>
          {promoCodes.map((code) => {
            const outcome = applied.find((a) => a.code === code);
            return (
              <motion.li key={code} layout initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: justApplied === code ? [1, 1.12, 1] : 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={{ type: "spring", stiffness: 600, damping: 22 }}>
                <span className="inline-flex min-h-[2.25rem] pointer-coarse:min-h-tap items-center gap-2 rounded-pill border border-price/50 bg-price/10 pl-3 text-sm text-price">
                  <Check className="size-3.5" aria-hidden />
                  <span className="font-mono tracking-wider">{code}</span>
                  {outcome && outcome.amount > 0 && (
                    <span className="text-xs">
                      −<Money value={outcome.amount} />
                    </span>
                  )}
                  <button type="button" onClick={() => setPromoCodes(promoCodes.filter((c) => c !== code))} aria-label={`Remove code ${code}`} className="grid size-9 place-items-center rounded-full hover:bg-price/20">
                    <X className="size-3.5" />
                  </button>
                </span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}

export function TotalsList({ totals, loading, className }: { totals: PricingResult; loading?: boolean; className?: string }) {
  const savings = totals.tierDiscount + totals.bundleDiscount;
  const rows = useMemo(
    () =>
      [
        { label: "Subtotal", value: totals.subtotal, show: true },
        { label: "Volume pricing", value: -totals.tierDiscount, show: totals.tierDiscount > 0, tone: "save" },
        { label: "Bundle savings", value: -totals.bundleDiscount, show: totals.bundleDiscount > 0, tone: "save" },
        ...totals.promos.filter((p) => p.applied && p.amount > 0).map((p) => ({ label: `Code ${p.code}`, value: -p.amount, show: true, tone: "save" })),
        { label: totals.freeShippingApplied ? "Shipping (free)" : "Shipping", value: totals.shippingFee, show: true },
        { label: "Gift wrap", value: totals.giftWrapFee, show: totals.giftWrapFee > 0 },
      ].filter((r) => r.show),
    [totals],
  );
  return (
    <dl className={cn("space-y-2.5 text-sm transition-opacity", loading && "opacity-60", className)} aria-busy={loading}>
      {rows.map((r) => (
        <div key={r.label} className={cn("flex justify-between gap-4", r.tone === "save" ? "text-price" : "text-muted")}>
          <dt>{r.label}</dt>
          <dd className="tabular-nums">{r.value < 0 ? <>−<Money value={-r.value} /></> : r.value === 0 && r.label.startsWith("Shipping") ? "Free" : <Money value={r.value} />}</dd>
        </div>
      ))}
      <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3 text-fg">
        <dt className="text-lg">Total</dt>
        <dd className="text-2xl tabular-nums">
          <motion.span key={totals.total} initial={{ opacity: 0.4, y: -4 }} animate={{ opacity: 1, y: 0 }} className="inline-block">
            <Money value={totals.total} />
          </motion.span>
        </dd>
      </div>
      <p className="text-xs text-subtle">
        Includes <Money value={totals.taxIncluded} /> VAT (12%).
        {savings + totals.promoDiscount > 0 && (
          <span className="ml-1 text-price">
            You save <Money value={savings + totals.promoDiscount} />.
          </span>
        )}
      </p>
    </dl>
  );
}

export function GiftWrapToggle() {
  const { giftWrap, setGiftWrap } = useCheckoutOptions();
  return (
    <label className="flex min-h-tap cursor-pointer items-center gap-3 rounded-md border border-line p-3 transition hover:border-line-strong has-[:checked]:border-accent has-[:checked]:bg-accent/10">
      <input type="checkbox" checked={giftWrap} onChange={(e) => setGiftWrap(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
      <Gift className="size-5 text-accent" aria-hidden />
      <span className="flex-1 text-sm">
        Gift wrap with a handwritten note <span className="text-muted">(+₱75)</span>
      </span>
    </label>
  );
}
