"use client";

import { AnimatePresence } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { Money } from "@/components/ui/bits";
import { buttonVariants } from "@/components/ui/button";
import { Sheet } from "@/components/ui/overlay";
import { cn, pluralize } from "@/lib/utils";
import { useCart } from "@/stores/cart";
import { CartLine, FreeShippingMeter } from "./cart-pieces";

export function CartDrawer() {
  const open = useCart((s) => s.panel === "cart");
  const setPanel = useCart((s) => s.setPanel);
  const cart = useCart((s) => s.cart);
  const close = () => setPanel(null);
  const t = cart?.totals;

  return (
    <Sheet open={open} onOpenChange={(o) => setPanel(o ? "cart" : null)} title="Your bag" description={cart ? pluralize(cart.itemCount, "item") : undefined}>
      {!cart || cart.lines.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <span className="grid size-20 place-items-center rounded-full border border-line">
            <ShoppingBag className="size-8 text-muted" aria-hidden />
          </span>
          <p className="text-lg">Your bag is empty</p>
          <p className="max-w-[18rem] text-sm text-muted">Trending right now: Air Pods, the Black Cat Plushie and our heavyweight Blue Jacket.</p>
          <Link href="/products" onClick={close} className={buttonVariants({ variant: "outline" })}>
            Start shopping
          </Link>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-6">
            <div className="pt-4">
              <FreeShippingMeter remaining={t!.freeShippingRemaining} applied={t!.freeShippingApplied} />
            </div>
            {cart.issues.length > 0 && (
              <ul className="mt-3 space-y-1 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning" aria-live="polite">
                {cart.issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            )}
            <ul className="divide-y divide-line">
              <AnimatePresence initial={false}>
                {cart.lines.map((l) => (
                  <CartLine key={l.variantId} line={l} compact />
                ))}
              </AnimatePresence>
            </ul>
          </div>
          <div className="space-y-3 border-t border-line p-6">
            {t!.tierDiscount + t!.bundleDiscount > 0 && (
              <div className="flex justify-between text-sm text-price">
                <span>Bundle &amp; volume savings</span>
                <span>
                  −<Money value={t!.tierDiscount + t!.bundleDiscount} />
                </span>
              </div>
            )}
            <div className="flex justify-between text-lg">
              <span>Subtotal</span>
              <Money value={t!.merchandiseTotal} />
            </div>
            <p className="text-xs text-muted">VAT included. Shipping and promo codes are calculated at checkout.</p>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/cart" onClick={close} className={cn(buttonVariants({ variant: "outline" }))}>
                View bag
              </Link>
              <Link href="/checkout" onClick={close} className={cn(buttonVariants({ variant: "primary" }))}>
                Checkout
              </Link>
            </div>
          </div>
        </>
      )}
    </Sheet>
  );
}
