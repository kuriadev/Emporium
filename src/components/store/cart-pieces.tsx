"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, Trash2, Truck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Money } from "@/components/ui/bits";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/pricing";
import type { CartLineView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MAX_LINE_QTY } from "@/lib/validations/commerce";
import { useCart } from "@/stores/cart";

export function QuantityStepper({ value, max, onChange, label, size = "md" }: { value: number; max: number; onChange: (n: number) => void; label: string; size?: "sm" | "md" }) {
  const cap = Math.min(max, MAX_LINE_QTY);
  const btn = cn("grid place-items-center rounded-full text-muted transition hover:bg-white/10 hover:text-fg active:scale-90 disabled:opacity-30", size === "sm" ? "size-9" : "size-tap");
  return (
    <div role="group" aria-label={`Quantity for ${label}`} className="inline-flex items-center rounded-pill border border-line">
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={value <= 0} aria-label="Decrease quantity">
        <Minus className="size-4" />
      </button>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.output
          key={value}
          aria-live="polite"
          initial={{ y: -10, opacity: 0, scale: 1.3 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 10, opacity: 0 }}
          transition={{ type: "spring", stiffness: 700, damping: 26 }}
          className="w-8 text-center tabular-nums"
        >
          {value}
        </motion.output>
      </AnimatePresence>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={value >= cap} aria-label="Increase quantity">
        <Plus className="size-4" />
      </button>
    </div>
  );
}

export function FreeShippingMeter({ remaining, applied }: { remaining: number; applied: boolean }) {
  const pct = applied ? 100 : Math.max(4, Math.min(100, ((FREE_SHIPPING_THRESHOLD - remaining) / FREE_SHIPPING_THRESHOLD) * 100));
  return (
    <div className="rounded-md border border-line bg-surface/60 p-4">
      <p className="flex items-center gap-2 text-sm" aria-live="polite">
        <Truck className="size-4 text-price" aria-hidden />
        {applied ? (
          <span>You&apos;ve unlocked <strong className="font-medium text-price">free standard shipping</strong>.</span>
        ) : (
          <span>
            Add <strong className="font-medium text-fg"><Money value={remaining} /></strong> more for free shipping.
          </span>
        )}
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-pill bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Progress to free shipping">
        <motion.div className="h-full rounded-pill bg-gradient-to-r from-accent to-price" initial={false} animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
      </div>
    </div>
  );
}

export function CartLine({ line, compact }: { line: CartLineView; compact?: boolean }) {
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  return (
    <motion.li layout initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24, height: 0 }} transition={{ type: "spring", stiffness: 420, damping: 34 }} className="flex gap-4 py-4">
      <Link href={`/products/${line.slug}`} className="relative size-20 shrink-0 overflow-hidden rounded-md bg-white sm:size-24">
        {line.image && <Image src={line.image.src} alt={line.image.alt} fill sizes="6rem" className="object-cover" />}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/products/${line.slug}`} className="line-clamp-1 font-normal hover:underline">
              {line.name}
            </Link>
            <p className="text-xs text-muted">{line.variantLabel}</p>
            {line.quantity === 0 && <p className="mt-1 text-xs text-danger">Sold out, remove to continue</p>}
            {line.stock > 0 && line.stock <= 3 && <p className="mt-1 text-xs text-warning">Only {line.stock} left</p>}
          </div>
          <span className="text-price">
            <Money value={line.lineTotal} />
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <QuantityStepper value={line.quantity} max={line.stock} label={line.name} onChange={(n) => void setQuantity(line.variantId, n)} size={compact ? "sm" : "md"} />
          <button type="button" onClick={() => void remove(line.variantId)} className="inline-flex min-h-tap items-center gap-1.5 rounded-pill px-3 text-xs text-muted transition hover:bg-danger/10 hover:text-danger">
            <Trash2 className="size-4" aria-hidden /> Remove
          </button>
        </div>
      </div>
    </motion.li>
  );
}
