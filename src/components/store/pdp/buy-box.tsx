"use client";

import { AnimatePresence, motion } from "framer-motion";
import { GitCompareArrows, Heart, PackageCheck, RotateCcw, Share2, ShieldCheck, Truck } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Price, Stars } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { FREE_SHIPPING_THRESHOLD, VOLUME_TIERS } from "@/lib/pricing";
import type { ProductDetail } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCart } from "@/stores/cart";
import { MAX_COMPARE, usePrefs } from "@/stores/prefs";
import { AddToBag, SelectedPrice, useVariantSelection, VariantOptions } from "../purchase";

export interface DeliveryEstimate {
  label: string;
  fee: number;
  window: string;
}

export function BuyBox({ product, delivery }: { product: ProductDetail; delivery: DeliveryEstimate[] }) {
  const selection = useVariantSelection(product.variants);
  const variant = selection.selected;
  const wished = useCart((s) => s.wishlist.includes(product.id));
  const toggleWish = useCart((s) => s.toggleWishlist);
  const comparing = usePrefs((s) => s.compare.includes(product.id));
  const toggleCompare = usePrefs((s) => s.toggleCompare);
  const ctaRef = useRef<HTMLDivElement>(null);
  const [ctaVisible, setCtaVisible] = useState(true);

  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    // Only surface the sticky bar once the shopper has scrolled past the main button, not before reaching it.
    const io = new IntersectionObserver(([entry]) => setCtaVisible(!entry || entry.isIntersecting || entry.boundingClientRect.top > 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: product.name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* user dismissed the share sheet */
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-2xs uppercase tracking-[0.25em] text-subtle">{product.brand}</p>
        <h1 className="mt-2 text-3xl font-normal leading-tight">{product.name}</h1>
        <p className="mt-2 text-lg font-light text-muted">{product.tagline}</p>
        {product.ratingCount > 0 && (
          <a href="#reviews" className="mt-3 inline-flex min-h-tap items-center gap-2 text-sm text-muted hover:text-fg">
            <Stars value={product.ratingAvg} /> {product.ratingAvg.toFixed(1)} · {product.ratingCount} {product.ratingCount === 1 ? "review" : "reviews"}
          </a>
        )}
      </div>

      <SelectedPrice variant={variant} compareAt={product.compareAtPrice} />

      {product.tierPricing && (
        <div className="flex flex-wrap gap-2" aria-label="Volume pricing">
          {[...VOLUME_TIERS].reverse().map((t) => (
            <span key={t.minQty} className="rounded-pill border border-price/40 bg-price/10 px-3 py-1 text-xs text-price">
              Buy {t.minQty}{t.minQty === 3 ? "+" : ""}, save {t.pct}%
            </span>
          ))}
        </div>
      )}

      <VariantOptions {...selection} />

      <div ref={ctaRef} className="space-y-3">
        <AddToBag variant={variant} productName={product.name} />
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => void toggleWish(product.id)} aria-pressed={wished}>
            <motion.span animate={wished ? { scale: [1, 1.35, 1] } : { scale: 1 }} transition={{ duration: 0.3 }}>
              <Heart className={cn("size-4", wished && "fill-danger text-danger")} aria-hidden />
            </motion.span>
            {wished ? "Saved" : "Save"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={comparing}
            onClick={() => {
              if (!toggleCompare(product.id)) toast.error(`You can compare up to ${MAX_COMPARE} products`);
            }}
          >
            <GitCompareArrows className="size-4" aria-hidden /> {comparing ? "Comparing" : "Compare"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void share()}>
            <Share2 className="size-4" aria-hidden /> Share
          </Button>
        </div>
      </div>

      <section aria-label="Delivery and returns" className="divide-y divide-line rounded-lg border border-line bg-surface/60">
        <div className="flex gap-3 p-4">
          <Truck className="mt-0.5 size-5 shrink-0 text-price" aria-hidden />
          <div className="space-y-1 text-sm">
            <p className="text-fg">Delivery to Metro Manila and nationwide</p>
            <ul className="space-y-0.5 text-muted">
              {delivery.map((d) => (
                <li key={d.label}>
                  <span className="text-fg">{d.label}</span> ({formatMoney(d.fee)}): arrives {d.window}
                </li>
              ))}
            </ul>
            <p className="text-muted">Free standard shipping on orders over {formatMoney(FREE_SHIPPING_THRESHOLD)}.</p>
          </div>
        </div>
        <div className="flex gap-3 p-4 text-sm">
          <RotateCcw className="mt-0.5 size-5 shrink-0 text-price" aria-hidden />
          <p className="text-muted">
            <span className="text-fg">30-day returns.</span> Start a return from your order page once it&apos;s delivered.
          </p>
        </div>
        <div className="flex gap-3 p-4 text-sm">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-price" aria-hidden />
          <p className="text-muted">
            <span className="text-fg">Price includes 12% VAT.</span> No surprise fees at checkout.
          </p>
        </div>
        {variant && (
          <div className="flex gap-3 p-4 text-sm">
            <PackageCheck className="mt-0.5 size-5 shrink-0 text-price" aria-hidden />
            <p className="text-muted">
              SKU <span className="font-mono text-xs text-fg">{variant.sku}</span>
            </p>
          </div>
        )}
      </section>

      <AnimatePresence>
        {!ctaVisible && variant && variant.stock > 0 && (
          <motion.div
            initial={{ y: "120%" }}
            animate={{ y: 0 }}
            exit={{ y: "120%" }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
            className="glass fixed inset-x-3 bottom-[5.5rem] z-30 flex items-center gap-3 rounded-lg p-2 pl-3 lg:hidden"
            role="region"
            aria-label="Quick add to bag"
          >
            {product.images[0] && (
              <span className="relative size-11 shrink-0 overflow-hidden rounded-sm bg-white">
                <Image src={product.images[0].src} alt="" fill sizes="2.75rem" className="object-cover" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{product.name}</p>
              <Price value={variant.price} size="sm" />
            </div>
            <div className="shrink-0">
              <AddToBag variant={variant} productName={product.name} sticky />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
