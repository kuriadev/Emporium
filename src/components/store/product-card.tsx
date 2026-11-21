"use client";

import { motion } from "framer-motion";
import { Eye, GitCompareArrows, Heart, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Price, Stars } from "@/components/ui/bits";
import type { ProductCardData } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCart } from "@/stores/cart";
import { MAX_COMPARE, usePrefs } from "@/stores/prefs";
import { useQuickView } from "./quick-view";

export function ProductCard({ product, priority, className }: { product: ProductCardData; priority?: boolean; className?: string }) {
  const [hover, setHover] = useState(false);
  const [swatch, setSwatch] = useState(product.swatches[0]?.color ?? null);
  const add = useCart((s) => s.add);
  const busy = useCart((s) => s.busyVariant !== null && s.busyVariant === product.defaultVariantId);
  const wished = useCart((s) => s.wishlist.includes(product.id));
  const toggleWish = useCart((s) => s.toggleWishlist);
  const comparing = usePrefs((s) => s.compare.includes(product.id));
  const toggleCompare = usePrefs((s) => s.toggleCompare);
  const openQuickView = useQuickView((s) => s.show);
  const primary = product.images[0];
  const secondary = product.images[1] ?? primary;
  const soldOut = product.totalStock <= 0;
  const needsChoice = product.variantCount > 1;

  const quickAdd = () => {
    if (needsChoice || !product.defaultVariantId) openQuickView(product.slug);
    else void add(product.defaultVariantId, 1);
  };

  return (
    <motion.article
      layout
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn("group relative flex flex-col rounded-xl bg-black p-3 ring-1 ring-line transition-shadow hover:shadow-[0_1.5rem_3rem_-1.5rem_oklch(1_0_0/0.2)] hover:ring-line-strong sm:p-5", className)}
    >
      <div className="relative aspect-square overflow-hidden rounded-lg bg-white sm:aspect-[4/3]">
        <Link href={`/products/${product.slug}`} tabIndex={-1} aria-hidden>
          {primary && (
            <Image src={primary.src} alt={primary.alt} fill priority={priority} sizes="(min-width: 80rem) 22rem, (min-width: 48rem) 33vw, 90vw" className={cn("object-cover transition-opacity duration-300", hover && secondary !== primary && "opacity-0")} />
          )}
          {secondary && secondary !== primary && (
            <Image src={secondary.src} alt="" fill sizes="(min-width: 80rem) 22rem, (min-width: 48rem) 33vw, 90vw" className={cn("scale-105 object-cover opacity-0 transition-[opacity,transform] duration-500", hover && "scale-100 opacity-100")} />
          )}
        </Link>
        {product.compareAtPrice && product.compareAtPrice > product.price && (
          <span className="absolute left-3 top-3 rounded-pill bg-danger px-2.5 py-1 text-2xs uppercase tracking-wider text-white">Sale</span>
        )}
        {soldOut && <span className="absolute inset-x-3 bottom-3 rounded-pill bg-black/80 py-1.5 text-center text-xs uppercase tracking-wider text-white">Sold out · notify me</span>}
        <div className="absolute right-2 top-2 flex flex-col gap-1.5">
          <CardIcon label={wished ? "Remove from wishlist" : "Save to wishlist"} pressed={wished} onClick={() => void toggleWish(product.id)}>
            <Heart className={cn("size-[1.1rem]", wished && "fill-danger text-danger")} />
          </CardIcon>
          <CardIcon
            label={comparing ? "Remove from comparison" : "Add to comparison"}
            pressed={comparing}
            onClick={() => {
              if (!toggleCompare(product.id)) toast.error(`Compare up to ${MAX_COMPARE} products`);
              else if (!comparing) useCart.getState().setPanel(null);
            }}
          >
            <GitCompareArrows className={cn("size-[1.1rem]", comparing && "text-accent")} />
          </CardIcon>
          <CardIcon label={`Quick view ${product.name}`} onClick={() => openQuickView(product.slug)} className="hidden sm:grid">
            <Eye className="size-[1.1rem]" />
          </CardIcon>
        </div>
      </div>

      <div className="mt-3 min-w-0 sm:mt-4">
        <h3 className="line-clamp-2 text-base leading-snug sm:text-lg">
          <Link href={`/products/${product.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {product.name}
          </Link>
        </h3>
        <p className="mt-1 truncate text-2xs uppercase tracking-[0.2em] text-subtle">{product.brand}</p>
        {product.ratingCount > 0 && <Stars className="mt-2" value={product.ratingAvg} count={product.ratingCount} />}
      </div>

      {product.swatches.length > 1 && (
        <div className="relative z-10 mt-2 flex flex-wrap items-center gap-x-1 sm:gap-x-2" role="radiogroup" aria-label="Colour">
          {product.swatches.map((s) => (
            <button
              key={s.color}
              type="button"
              role="radio"
              aria-checked={swatch === s.color}
              aria-label={s.color}
              title={s.color}
              onClick={() => setSwatch(s.color)}
              className="grid size-tap place-items-center rounded-full"
            >
              <span className={cn("size-5 rounded-full ring-1 ring-white/30 ring-offset-2 ring-offset-black transition", swatch === s.color && "ring-2 ring-fg")} style={{ background: s.hex }} />
            </button>
          ))}
          <span className="hidden text-xs text-subtle sm:inline">{swatch}</span>
        </div>
      )}

      <div className="mt-auto flex items-end justify-between gap-2 pt-3">
        <Price value={product.price} compareAt={product.compareAtPrice} className="min-w-0" />
        <motion.button
          type="button"
          onClick={quickAdd}
          disabled={soldOut || busy}
          whileTap={{ scale: 0.85 }}
          aria-label={soldOut ? `${product.name} is sold out` : needsChoice ? `Choose options for ${product.name}` : `Add ${product.name} to bag`}
          className="relative z-10 inline-flex min-h-tap min-w-tap shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-pill bg-white/10 px-3 text-xs text-muted transition hover:bg-white hover:text-bg disabled:opacity-40"
        >
          <Plus className={cn("size-4", busy && "animate-spin")} />
          <span className="max-w-0 overflow-hidden transition-[max-width] duration-300 [@media(hover:hover)]:group-hover:max-w-[6rem] [@media(hover:hover)]:group-focus-within:max-w-[6rem]">{needsChoice ? "Options" : "Add"}</span>
        </motion.button>
      </div>
    </motion.article>
  );
}

function CardIcon({ label, onClick, pressed, children, className }: { label: string; onClick: () => void; pressed?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      whileTap={{ scale: 0.8 }}
      className={cn("relative z-10 grid size-tap place-items-center rounded-full bg-black/55 text-white backdrop-blur-md transition hover:bg-black/80", className)}
    >
      {children}
    </motion.button>
  );
}
