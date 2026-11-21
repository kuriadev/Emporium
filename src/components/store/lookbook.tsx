"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Price } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import type { ProductCardData } from "@/lib/types";
import { useCart } from "@/stores/cart";
import { useQuickView } from "./quick-view";

/** [left %, top %, width %, rotation deg] for phone (square canvas) and desktop (16:9 canvas). */
type Placement = readonly [number, number, number, number];

export interface LookPiece {
  product: ProductCardData;
  mobile: Placement;
  desktop: Placement;
}

/**
 * Shop-the-look flat-lay: product shots arranged like prints on a dark table, each with a pulsing
 * hotspot that opens a mini card with quick add. Escape or the close pin dismisses it.
 */
export function Lookbook({ title, eyebrow = "Lookbook", pieces }: { title: string; eyebrow?: string; pieces: LookPiece[] }) {
  const [active, setActive] = useState<number | null>(null);
  const add = useCart((s) => s.add);
  const quick = useQuickView((s) => s.show);
  const current = active === null ? null : pieces[active];

  useEffect(() => {
    if (active === null) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setActive(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  return (
    <figure className="relative overflow-hidden rounded-xl bg-[radial-gradient(90%_80%_at_50%_0%,oklch(0.2_0_0),oklch(0.07_0_0))] ring-1 ring-line">
      <figcaption className="relative z-10 p-6 pb-0 md:absolute md:left-8 md:top-8 md:max-w-[18rem] md:p-0">
        <p className="text-2xs uppercase tracking-[0.3em] text-subtle">{eyebrow}</p>
        <p className="mt-1 text-2xl">{title}</p>
        <p className="mt-2 text-sm text-muted">Tap a pin to shop the piece.</p>
      </figcaption>
      <div className="relative aspect-square md:aspect-[16/9]">
        {pieces.map((piece, i) => {
          const [mx, my, mw, mr] = piece.mobile;
          const [dx, dy, dw, dr] = piece.desktop;
          const vars = { "--mx": `${mx}%`, "--my": `${my}%`, "--mw": `${mw}%`, "--mr": `${mr}deg`, "--dx": `${dx}%`, "--dy": `${dy}%`, "--dw": `${dw}%`, "--dr": `${dr}deg` } as React.CSSProperties;
          const open = active === i;
          return (
            <motion.div
              key={piece.product.id}
              style={vars}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ type: "spring", stiffness: 160, damping: 22, delay: i * 0.08 }}
              className="absolute left-[var(--mx)] top-[var(--my)] w-[var(--mw)] md:left-[var(--dx)] md:top-[var(--dy)] md:w-[var(--dw)]"
            >
              <div className="rotate-[var(--mr)] transition-transform duration-300 md:rotate-[var(--dr)]">
                <div className="relative aspect-square overflow-hidden rounded-md bg-white shadow-[0_1.5rem_3rem_-1rem_oklch(0_0_0/0.9)]">
                  {piece.product.images[0] && <Image src={piece.product.images[0].src} alt={piece.product.images[0].alt} fill sizes="(min-width: 48rem) 20vw, 35vw" className="object-cover" />}
                </div>
              </div>
              <motion.button
                type="button"
                onClick={() => setActive(open ? null : i)}
                aria-expanded={open}
                aria-controls="lookbook-card"
                aria-label={`${open ? "Hide" : "Show"} ${piece.product.name}`}
                className="absolute -right-3 -top-3 grid size-tap place-items-center rounded-full bg-fg text-bg shadow-lg"
                whileTap={{ scale: 0.85 }}
                whileHover={{ scale: 1.08 }}
              >
                {!open && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-fg/60 [animation-duration:1.8s]" />}
                {open ? <X className="relative size-5" /> : <Plus className="relative size-5" />}
              </motion.button>
            </motion.div>
          );
        })}

        <AnimatePresence>
          {current && (
            <motion.div
              id="lookbook-card"
              key={current.product.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              className="glass absolute bottom-3 left-3 right-3 z-20 flex items-center gap-4 rounded-lg p-3 md:bottom-6 md:left-auto md:right-6 md:w-[24rem]"
              role="region"
              aria-label={`${current.product.name} details`}
            >
              <span className="relative size-20 shrink-0 overflow-hidden rounded-md bg-white">
                {current.product.images[0] && <Image src={current.product.images[0].src} alt="" fill sizes="5rem" className="object-cover" />}
              </span>
              <div className="min-w-0 flex-1">
                <Link href={`/products/${current.product.slug}`} className="line-clamp-1 hover:underline">
                  {current.product.name}
                </Link>
                <Price value={current.product.price} compareAt={current.product.compareAtPrice} size="sm" />
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    disabled={current.product.totalStock <= 0}
                    onClick={() => {
                      const p = current.product;
                      if (p.variantCount > 1 || !p.defaultVariantId) quick(p.slug);
                      else void add(p.defaultVariantId);
                    }}
                  >
                    {current.product.totalStock <= 0 ? "Sold out" : "Quick add"}
                  </Button>
                  <Link href={`/products/${current.product.slug}`} className="inline-flex min-h-[2.25rem] items-center px-2 text-sm text-muted hover:text-fg">
                    Details
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </figure>
  );
}
