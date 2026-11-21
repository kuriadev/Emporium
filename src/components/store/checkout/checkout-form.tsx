"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Banknote, Check, ChevronDown, CreditCard, Lock, MapPin, Smartphone, Truck, Zap } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { get, useForm, type FieldPath } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Money, Skeleton } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Field } from "@/components/ui/field";
import { formatDate } from "@/lib/money";
import { deliveryWindow, SHIPPING_RATES, type ShippingTierKey } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { checkoutSchema } from "@/lib/validations/commerce";
import { placeOrderAction } from "@/server/actions/shop";
import { useCart } from "@/stores/cart";
import { useCheckoutOptions } from "@/stores/checkout";
import { GiftWrapToggle, PromoCodeInput, TotalsList, useQuote } from "./quote";

const formSchema = checkoutSchema.omit({ idempotencyKey: true, promoCodes: true, shippingTier: true, giftWrap: true });
type FormIn = z.input<typeof formSchema>;
type FormOut = z.output<typeof formSchema>;

export interface CheckoutAddress {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  province: string;
  postalCode: string;
  isDefault: boolean;
}

const IDEM_KEY = "emporium-checkout-key";
const STEPS = ["Contact", "Shipping address", "Delivery", "Payment"] as const;
const STEP_FIELDS: FieldPath<FormIn>[][] = [
  ["contact.email"],
  ["shipping.fullName", "shipping.phone", "shipping.line1", "shipping.line2", "shipping.city", "shipping.province", "shipping.postalCode"],
  ["giftNote"],
  ["payment"],
];

const PAYMENT_PRESETS = [
  { label: "Test card · approves", apply: { method: "card", cardNumber: "4242 4242 4242 4242", cardExpiry: "12/29", cardCvc: "123" } },
  { label: "Test card · declines", apply: { method: "card", cardNumber: "4000 0000 0000 0002", cardExpiry: "12/29", cardCvc: "123" } },
  { label: "GCash", apply: { method: "gcash", gcashNumber: "09171234567" } },
  { label: "Cash on delivery", apply: { method: "cod" } },
] as const;

const formatCard = (v: string) =>
  v
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
const formatExpiry = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};
const cardBrand = (v: string) => {
  const d = v.replace(/\D/g, "");
  if (/^4/.test(d)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(d)) return "Mastercard";
  if (/^3[47]/.test(d)) return "Amex";
  return null;
};

export function CheckoutForm({ email, name, addresses }: { email: string; name: string; addresses: CheckoutAddress[] }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const cart = useCart((s) => s.cart);
  const hydrate = useCart((s) => s.hydrate);
  const { promoCodes, shippingTier, giftWrap, setShippingTier, reset } = useCheckoutOptions();
  const { quote, loading } = useQuote();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [formError, setFormError] = useState<string>();
  const [shake, setShake] = useState(0);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const idem = useRef<string | null>(null);
  const initial = addresses.find((a) => a.isDefault) ?? addresses[0];
  const [addressId, setAddressId] = useState<string | null>(initial?.id ?? null);

  useEffect(() => {
    const existing = sessionStorage.getItem(IDEM_KEY);
    idem.current = existing ?? crypto.randomUUID();
    sessionStorage.setItem(IDEM_KEY, idem.current);
  }, []);

  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(formSchema),
    mode: "onTouched",
    defaultValues: {
      contact: { email, marketingOptIn: false },
      shipping: initial
        ? { fullName: initial.fullName, phone: initial.phone, line1: initial.line1, line2: initial.line2, city: initial.city, province: initial.province, postalCode: initial.postalCode, country: "PH" }
        : { fullName: name || "Alex Rivera", phone: "+63 917 555 0142", line1: "Unit 12B, The Residences, 88 Ayala Avenue", line2: "Bel-Air", city: "Makati", province: "Metro Manila", postalCode: "1226", country: "PH" },
      payment: { method: "card", cardName: name || "Alex Rivera", cardNumber: "4242 4242 4242 4242", cardExpiry: "12/29", cardCvc: "123" },
      giftNote: "",
      saveAddress: !initial,
    },
  });
  const { errors, isSubmitting, submitCount, dirtyFields } = form.formState;
  const method = form.watch("payment.method");
  const cardNumber = form.watch("payment.cardNumber" as FieldPath<FormIn>) as string | undefined;
  const err = (path: string): string | undefined => (get(errors, path) as { message?: string } | undefined)?.message;
  const ok = (path: string) => !!get(dirtyFields, path) && !err(path);

  const advance = async (i: number) => {
    const valid = await form.trigger(STEP_FIELDS[i]);
    if (!valid) {
      setShake((n) => n + 1);
      return;
    }
    setDone((d) => new Set(d).add(i));
    setStep(Math.min(i + 1, STEPS.length - 1));
  };

  const pickAddress = (a: CheckoutAddress) => {
    setAddressId(a.id);
    for (const k of ["fullName", "phone", "line1", "line2", "city", "province", "postalCode"] as const) form.setValue(`shipping.${k}`, a[k], { shouldValidate: true });
    form.setValue("saveAddress", false);
  };

  const onSubmit = form.handleSubmit(
    async (data) => {
      setFormError(undefined);
      const key = idem.current ?? crypto.randomUUID();
      const res = await placeOrderAction({ ...data, idempotencyKey: key, promoCodes, shippingTier, giftWrap });
      if (!res.ok) {
        setFormError(res.error);
        setShake((n) => n + 1);
        for (const [path, message] of Object.entries(res.fieldErrors ?? {})) {
          if (path === "payment" || path.startsWith("payment.")) setStep(3);
          else if (path.startsWith("shipping.")) setStep(1);
          if (path !== "promoCodes") form.setError(path as FieldPath<FormIn>, { message });
        }
        if (res.retryAfter) toast.error(res.error);
        return;
      }
      sessionStorage.removeItem(IDEM_KEY);
      reset();
      void hydrate();
      router.push(`/orders/${res.data.orderId}?placed=1`);
    },
    (invalid) => {
      setShake((n) => n + 1);
      const first = STEP_FIELDS.findIndex((fields) => fields.some((f) => get(invalid, f)));
      if (first >= 0) setStep(first);
      setFormError("Please fix the highlighted fields.");
    },
  );

  if (!cart) return <CheckoutSkeleton />;
  if (cart.lines.length === 0)
    return (
      <div className="rounded-xl border border-dashed border-line-strong p-10 text-center">
        <h2 className="text-2xl font-light">Your bag is empty</h2>
        <p className="mt-2 text-muted">Add something you love, then come back to check out.</p>
        <Link href="/products" className={cn(buttonVariants(), "mt-6")}>
          Browse products
        </Link>
      </div>
    );

  const totals = quote?.totals ?? cart.totals;
  const shipping = form.watch("shipping");

  const summary = (
    <div className="space-y-5">
      <ul className="divide-y divide-line">
        {cart.lines.map((l) => (
          <li key={l.variantId} className="flex items-center gap-3 py-3">
            <span className="relative size-14 shrink-0 overflow-hidden rounded-sm bg-white">
              {l.image && <Image src={l.image.src} alt="" fill sizes="3.5rem" className="object-cover" />}
              <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-pill bg-fg px-1 text-2xs text-bg">{l.quantity}</span>
            </span>
            <span className="min-w-0 flex-1 text-sm">
              <span className="line-clamp-1">{l.name}</span>
              <span className="text-xs text-muted">{l.variantLabel}</span>
            </span>
            <span className="text-sm tabular-nums">
              <Money value={l.lineTotal} />
            </span>
          </li>
        ))}
      </ul>
      <PromoCodeInput quote={quote} />
      <TotalsList totals={totals} loading={loading} />
    </div>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="space-y-4">
        <div className="rounded-xl border border-line lg:hidden">
          <button type="button" onClick={() => setSummaryOpen((o) => !o)} aria-expanded={summaryOpen} aria-controls="mobile-summary" className="flex min-h-tap w-full items-center justify-between gap-3 px-4 py-3">
            <span className="flex items-center gap-2 text-sm">
              <ChevronDown className={cn("size-4 transition-transform", summaryOpen && "rotate-180")} aria-hidden /> {summaryOpen ? "Hide" : "Show"} order summary
            </span>
            <span className="tabular-nums">
              <Money value={totals.total} />
            </span>
          </button>
          <AnimatePresence initial={false}>
            {summaryOpen && (
              <motion.div id="mobile-summary" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-4 pb-4">
                {summary}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Section index={0} step={step} done={done} onOpen={setStep} summary={form.watch("contact.email")}>
          <Field label="Email for receipts and tracking" type="email" autoComplete="email" required {...form.register("contact.email")} error={err("contact.email")} valid={ok("contact.email")} shakeKey={shake} />
          <label className="flex min-h-tap cursor-pointer items-center gap-3 text-sm text-muted">
            <input type="checkbox" {...form.register("contact.marketingOptIn")} className="size-4 accent-[var(--color-accent)]" />
            Email me early access to drops and member-only codes
          </label>
          <ContinueButton onClick={() => void advance(0)} />
        </Section>

        <Section index={1} step={step} done={done} onOpen={setStep} summary={`${shipping.fullName}, ${shipping.line1}, ${shipping.city} ${shipping.postalCode}`}>
          {addresses.length > 0 && (
            <fieldset>
              <legend className="mb-2 text-sm text-muted">Saved addresses</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {addresses.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => pickAddress(a)}
                    aria-pressed={addressId === a.id}
                    className={cn("flex min-h-tap items-start gap-3 rounded-md border p-3 text-left text-sm transition", addressId === a.id ? "border-accent bg-accent/10" : "border-line hover:border-line-strong")}
                  >
                    <MapPin className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                    <span>
                      <span className="block">
                        {a.label}
                        {a.isDefault && <span className="ml-2 text-2xs uppercase tracking-wider text-subtle">Default</span>}
                      </span>
                      <span className="block text-muted">
                        {a.line1}, {a.city}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" autoComplete="name" required {...form.register("shipping.fullName", { onChange: () => setAddressId(null) })} error={err("shipping.fullName")} valid={ok("shipping.fullName")} shakeKey={shake} />
            <Field label="Mobile number" type="tel" autoComplete="tel" required {...form.register("shipping.phone", { onChange: () => setAddressId(null) })} error={err("shipping.phone")} valid={ok("shipping.phone")} shakeKey={shake} />
          </div>
          <Field label="Street address" autoComplete="address-line1" required {...form.register("shipping.line1", { onChange: () => setAddressId(null) })} error={err("shipping.line1")} valid={ok("shipping.line1")} shakeKey={shake} />
          <Field label="Barangay, building or landmark (optional)" autoComplete="address-line2" {...form.register("shipping.line2")} error={err("shipping.line2")} shakeKey={shake} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="City" autoComplete="address-level2" required {...form.register("shipping.city", { onChange: () => setAddressId(null) })} error={err("shipping.city")} valid={ok("shipping.city")} shakeKey={shake} />
            <Field label="Province" autoComplete="address-level1" required {...form.register("shipping.province")} error={err("shipping.province")} valid={ok("shipping.province")} shakeKey={shake} />
            <Field label="Postal code" inputMode="numeric" autoComplete="postal-code" maxLength={4} required {...form.register("shipping.postalCode", { onChange: () => setAddressId(null) })} error={err("shipping.postalCode")} valid={ok("shipping.postalCode")} shakeKey={shake} />
          </div>
          <p className="text-xs text-subtle">We currently ship within the Philippines.</p>
          {!addressId && (
            <label className="flex min-h-tap cursor-pointer items-center gap-3 text-sm text-muted">
              <input type="checkbox" {...form.register("saveAddress")} className="size-4 accent-[var(--color-accent)]" />
              Save this address to my account
            </label>
          )}
          <ContinueButton onClick={() => void advance(1)} />
        </Section>

        <Section index={2} step={step} done={done} onOpen={setStep} summary={`${SHIPPING_RATES[shippingTier].label}${giftWrap ? " · gift wrapped" : ""}`}>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm text-muted">Delivery speed</legend>
            {(Object.keys(SHIPPING_RATES) as ShippingTierKey[]).map((tier) => {
              const rate = SHIPPING_RATES[tier];
              const w = deliveryWindow(tier);
              const on = shippingTier === tier;
              const Icon = tier === "express" ? Zap : Truck;
              return (
                <label key={tier} className={cn("flex min-h-tap cursor-pointer items-center gap-3 rounded-md border p-3 transition", on ? "border-accent bg-accent/10" : "border-line hover:border-line-strong")}>
                  <input type="radio" name="shippingTier" checked={on} onChange={() => setShippingTier(tier)} className="sr-only" />
                  <Icon className={cn("size-5", on ? "text-accent" : "text-muted")} aria-hidden />
                  <span className="flex-1 text-sm">
                    {rate.label} · {rate.minDays} to {rate.maxDays} business days
                    <span className="block text-xs text-muted">
                      Arrives {formatDate(w.from, { weekday: "short", month: "short", day: "numeric" })} to {formatDate(w.to, { weekday: "short", month: "short", day: "numeric" })}
                    </span>
                  </span>
                  <span className="text-sm tabular-nums">{tier === "standard" && totals.freeShippingApplied ? "Free" : <Money value={rate.fee} />}</span>
                </label>
              );
            })}
          </fieldset>
          <GiftWrapToggle />
          <AnimatePresence initial={false}>
            {giftWrap && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <Field as="textarea" label="Gift note (printed on a card, prices hidden)" maxLength={240} showCounter {...form.register("giftNote")} error={err("giftNote")} placeholder="Happy birthday, Sam! Enjoy the new jacket." />
              </motion.div>
            )}
          </AnimatePresence>
          <ContinueButton onClick={() => void advance(2)} />
        </Section>

        <Section index={3} step={step} done={done} onOpen={setStep} summary={method === "card" ? `Card ending ${(cardNumber ?? "").replace(/\D/g, "").slice(-4)}` : method === "gcash" ? "GCash" : "Cash on delivery"}>
          <div className="flex flex-wrap items-center gap-2 text-xs text-subtle">
            <span>Sandbox:</span>
            {PAYMENT_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  for (const [k, v] of Object.entries(p.apply)) form.setValue(`payment.${k}` as FieldPath<FormIn>, v as never, { shouldDirty: true, shouldValidate: k !== "method" });
                  setFormError(undefined);
                }}
                className="min-h-[2rem] rounded-pill border border-dashed border-line-strong px-2.5 text-muted transition hover:border-fg hover:text-fg active:scale-95"
              >
                {p.label}
              </button>
            ))}
          </div>
          <fieldset className="grid gap-2 sm:grid-cols-3">
            <legend className="sr-only">Payment method</legend>
            {(
              [
                { value: "card", label: "Card", icon: CreditCard },
                { value: "gcash", label: "GCash", icon: Smartphone },
                { value: "cod", label: "Cash on delivery", icon: Banknote },
              ] as const
            ).map((m) => (
              <label key={m.value} className={cn("flex min-h-tap cursor-pointer items-center gap-3 rounded-md border p-3 text-sm transition", method === m.value ? "border-accent bg-accent/10" : "border-line hover:border-line-strong")}>
                <input type="radio" value={m.value} {...form.register("payment.method")} className="sr-only" />
                <m.icon className={cn("size-5", method === m.value ? "text-accent" : "text-muted")} aria-hidden />
                {m.label}
              </label>
            ))}
          </fieldset>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={method} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="space-y-4">
              {method === "card" && (
                <>
                  <Field label="Name on card" autoComplete="cc-name" required {...form.register("payment.cardName" as FieldPath<FormIn>)} error={err("payment.cardName")} valid={ok("payment.cardName")} shakeKey={shake} />
                  <Field
                    label="Card number"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    required
                    {...form.register("payment.cardNumber" as FieldPath<FormIn>, { onChange: (e) => form.setValue("payment.cardNumber" as FieldPath<FormIn>, formatCard(e.target.value) as never) })}
                    error={err("payment.cardNumber")}
                    valid={ok("payment.cardNumber")}
                    shakeKey={shake}
                    suffix={cardBrand(cardNumber ?? "") ? <span className="text-xs text-muted">{cardBrand(cardNumber ?? "")}</span> : null}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Field
                      label="Expiry (MM/YY)"
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      required
                      {...form.register("payment.cardExpiry" as FieldPath<FormIn>, { onChange: (e) => form.setValue("payment.cardExpiry" as FieldPath<FormIn>, formatExpiry(e.target.value) as never) })}
                      error={err("payment.cardExpiry")}
                      valid={ok("payment.cardExpiry")}
                      shakeKey={shake}
                    />
                    <Field label="CVC" inputMode="numeric" autoComplete="cc-csc" maxLength={4} required {...form.register("payment.cardCvc" as FieldPath<FormIn>)} error={err("payment.cardCvc")} valid={ok("payment.cardCvc")} shakeKey={shake} />
                  </div>
                  <p className="flex items-center gap-2 text-xs text-subtle">
                    <Lock className="size-3.5" aria-hidden /> Sandbox payments: card details are validated, never stored. Only the last four digits appear on your receipt.
                  </p>
                </>
              )}
              {method === "gcash" && (
                <Field label="GCash mobile number" type="tel" inputMode="tel" autoComplete="tel" required {...form.register("payment.gcashNumber" as FieldPath<FormIn>)} error={err("payment.gcashNumber")} valid={ok("payment.gcashNumber")} shakeKey={shake} hint="You'll approve the payment in the GCash app." />
              )}
              {method === "cod" && <p className="rounded-md border border-line p-4 text-sm text-muted">Pay the courier in cash when your order arrives. Your order is confirmed as pending until payment is collected.</p>}
            </motion.div>
          </AnimatePresence>
        </Section>

        <AnimatePresence>
          {formError && (
            <motion.p key={shake} initial={{ opacity: 0, x: 0 }} animate={reduce ? { opacity: 1 } : { opacity: 1, x: [0, -8, 7, -4, 0] }} exit={{ opacity: 0 }} role="alert" className="rounded-md border border-danger/50 bg-danger/10 p-4 text-sm text-danger">
              {formError}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="hidden lg:block">
          <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
            <Lock className="size-4" aria-hidden /> Place order · <Money value={totals.total} />
          </Button>
          <p className="mt-3 text-center text-xs text-subtle">By placing your order you agree to our terms and 30-day return policy. Totals are re-checked on our servers.</p>
        </div>
      </div>

      <aside aria-label="Order summary" className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
        <div className="rounded-xl border border-line bg-surface/60 p-6">
          <h2 className="mb-2 text-xl">Order summary</h2>
          {summary}
        </div>
      </aside>

      <div className="glass fixed inset-x-3 bottom-[5.5rem] z-30 flex items-center gap-3 rounded-lg p-2 pl-4 lg:hidden">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">Total · {submitCount > 0 && Object.keys(errors).length ? "check the form" : "VAT included"}</p>
          <p className="text-lg tabular-nums">
            <Money value={totals.total} />
          </p>
        </div>
        <Button type="submit" loading={isSubmitting}>
          <Lock className="size-4" aria-hidden /> Place order
        </Button>
      </div>
    </form>
  );
}

function Section({ index, step, done, onOpen, summary, children }: { index: number; step: number; done: Set<number>; onOpen: (i: number) => void; summary: string; children: React.ReactNode }) {
  const open = step === index;
  const complete = done.has(index) && !open;
  return (
    <section aria-labelledby={`step-${index}`} className={cn("rounded-xl border transition-colors", open ? "border-line-strong bg-surface/60" : "border-line")}>
      <h2 id={`step-${index}`}>
        <button type="button" onClick={() => onOpen(index)} aria-expanded={open} className="flex min-h-[3.5rem] w-full items-center gap-3 px-5 text-left">
          <motion.span
            animate={complete ? { scale: [1, 1.25, 1] } : { scale: 1 }}
            className={cn("grid size-7 shrink-0 place-items-center rounded-full border text-xs", complete ? "border-success bg-success text-bg" : open ? "border-fg text-fg" : "border-line-strong text-muted")}
          >
            {complete ? <Check className="size-4" aria-hidden /> : index + 1}
          </motion.span>
          <span className="flex-1">
            <span className="block text-lg">{STEPS[index]}</span>
            {!open && done.has(index) && <span className="line-clamp-1 text-sm text-muted">{summary}</span>}
          </span>
          {!open && <span className="text-sm text-accent">{done.has(index) ? "Edit" : ""}</span>}
        </button>
      </h2>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 320, damping: 34 }} className="overflow-hidden">
            <div className="space-y-4 px-5 pb-6">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function ContinueButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" onClick={onClick}>
      Continue
    </Button>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="space-y-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="hidden h-96 w-full rounded-xl lg:block" />
    </div>
  );
}
