"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Lock, ShoppingBag, Truck, Zap } from "lucide-react";
import Link from "next/link";
import { Money, Skeleton } from "@/components/ui/bits";
import { buttonVariants } from "@/components/ui/button-variants";
import { formatDate } from "@/lib/money";
import { deliveryWindow, SHIPPING_RATES, type ShippingTierKey } from "@/lib/pricing";
import { cn, pluralize } from "@/lib/utils";
import { useCart } from "@/stores/cart";
import { useCheckoutOptions } from "@/stores/checkout";
import { CartLine, FreeShippingMeter } from "./cart-pieces";
import { GiftWrapToggle, PromoCodeInput, TotalsList, useQuote } from "./checkout/quote";

export function CartPage({ signedIn }: { signedIn: boolean }) {
  const cart = useCart((s) => s.cart);
  const { quote, loading } = useQuote();
  const { shippingTier, setShippingTier } = useCheckoutOptions();

  if (!cart)
    return (
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );

  if (cart.lines.length === 0)
    return (
      <div className="rounded-xl border border-dashed border-line-strong p-10 text-center">
        <ShoppingBag className="mx-auto size-10 text-subtle" aria-hidden />
        <h2 className="mt-4 text-2xl font-light">Your bag is empty</h2>
        <p className="mt-2 text-muted">Items you add stay here, even if you leave and come back.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/products" className={buttonVariants()}>
            Start shopping
          </Link>
          <Link href="/wishlist" className={buttonVariants({ variant: "outline" })}>
            View wishlist
          </Link>
        </div>
      </div>
    );

  const totals = quote?.totals ?? cart.totals;
  const checkoutHref = signedIn ? "/checkout" : `/login?next=${encodeURIComponent("/checkout")}`;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_26rem]">
      <section aria-labelledby="bag-lines">
        <h2 id="bag-lines" className="sr-only">
          Items in your bag
        </h2>
        <FreeShippingMeter remaining={totals.freeShippingRemaining} applied={totals.freeShippingApplied} />
        {cart.issues.length > 0 && (
          <ul className="mt-4 space-y-1 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning" aria-live="polite">
            {cart.issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        )}
        <ul className="mt-2 divide-y divide-line">
          <AnimatePresence initial={false}>
            {cart.lines.map((l) => (
              <CartLine key={l.variantId} line={l} />
            ))}
          </AnimatePresence>
        </ul>
        {quote && quote.appliedBundles.length > 0 && (
          <p className="mt-4 rounded-md border border-price/40 bg-price/10 p-3 text-sm text-price">
            Bundle applied: {quote.appliedBundles.map((b) => `${b.title} (−${b.pct}%)`).join(", ")}
          </p>
        )}
      </section>

      <aside aria-labelledby="summary-title" className="space-y-6 lg:sticky lg:top-24 lg:self-start">
        <div className="space-y-6 rounded-xl border border-line bg-surface/60 p-5 sm:p-6">
          <h2 id="summary-title" className="text-xl">
            Order summary <span className="text-sm text-muted">({pluralize(cart.itemCount, "item")})</span>
          </h2>
          <fieldset>
            <legend className="mb-2 text-sm text-muted">Delivery speed</legend>
            <div className="grid gap-2">
              {(Object.keys(SHIPPING_RATES) as ShippingTierKey[]).map((tier) => {
                const rate = SHIPPING_RATES[tier];
                const w = deliveryWindow(tier);
                const on = shippingTier === tier;
                const Icon = tier === "express" ? Zap : Truck;
                return (
                  <label key={tier} className={cn("flex min-h-tap cursor-pointer items-center gap-3 rounded-md border p-3 transition", on ? "border-accent bg-accent/10" : "border-line hover:border-line-strong")}>
                    <input type="radio" name="tier" value={tier} checked={on} onChange={() => setShippingTier(tier)} className="sr-only" />
                    <Icon className={cn("size-5", on ? "text-accent" : "text-muted")} aria-hidden />
                    <span className="flex-1 text-sm">
                      {rate.label}
                      <span className="block text-xs text-muted">
                        Arrives {formatDate(w.from, { month: "short", day: "numeric" })} to {formatDate(w.to, { month: "short", day: "numeric" })}
                      </span>
                    </span>
                    <span className="text-sm tabular-nums">{tier === "standard" && totals.freeShippingApplied ? "Free" : <Money value={rate.fee} />}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <GiftWrapToggle />
          <PromoCodeInput quote={quote} />
          <TotalsList totals={totals} loading={loading} />
          <Link href={checkoutHref} className={cn(buttonVariants({ size: "lg" }), "hidden w-full lg:inline-flex")}>
            <Lock className="size-4" aria-hidden /> {signedIn ? "Secure checkout" : "Sign in to check out"} <ArrowRight className="size-4" aria-hidden />
          </Link>
          {!signedIn && <p className="hidden text-center text-xs text-muted lg:block">Your bag and wishlist move to your account when you sign in.</p>}
        </div>
      </aside>

      <motion.div initial={{ y: "120%" }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 380, damping: 34, delay: 0.2 }} className="glass fixed inset-x-3 bottom-[5.5rem] z-30 flex items-center gap-3 rounded-lg p-2 pl-4 lg:hidden">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">Total</p>
          <p className="text-lg tabular-nums">
            <Money value={totals.total} />
          </p>
        </div>
        <Link href={checkoutHref} className={buttonVariants()}>
          <Lock className="size-4" aria-hidden /> Checkout
        </Link>
      </motion.div>
    </div>
  );
}
