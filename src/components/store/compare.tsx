"use client";

import { AnimatePresence, motion } from "framer-motion";
import { GitCompareArrows, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Price, Stars } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/overlay";
import type { ProductCardData } from "@/lib/types";
import { compareAction } from "@/server/actions/shop";
import { useCart } from "@/stores/cart";
import { MAX_COMPARE, usePrefs } from "@/stores/prefs";

export function CompareTray() {
  const ids = usePrefs((s) => s.compare);
  const clear = usePrefs((s) => s.clearCompare);
  const setPanel = useCart((s) => s.setPanel);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <AnimatePresence>
      {ids.length > 0 && (
        <motion.div
          initial={{ y: "150%" }}
          animate={{ y: 0 }}
          exit={{ y: "150%" }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="glass fixed inset-x-3 bottom-[5.25rem] z-40 mx-auto flex max-w-[34rem] items-center justify-between gap-3 rounded-pill py-2 pl-5 pr-2 lg:bottom-6"
          role="region"
          aria-label="Product comparison"
        >
          <span className="flex items-center gap-2 text-sm">
            <GitCompareArrows className="size-4 text-accent" aria-hidden />
            {ids.length}/{MAX_COMPARE} to compare
          </span>
          <span className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={clear}>
              Clear
            </Button>
            <Button size="sm" onClick={() => setPanel("compare")} disabled={ids.length < 2}>
              Compare
            </Button>
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function CompareSheet() {
  const open = useCart((s) => s.panel === "compare");
  const setPanel = useCart((s) => s.setPanel);
  const ids = usePrefs((s) => s.compare);
  const toggle = usePrefs((s) => s.toggleCompare);
  const [items, setItems] = useState<ProductCardData[]>([]);

  useEffect(() => {
    if (open) void compareAction(ids).then(setItems);
  }, [open, ids]);

  const specKeys = [...new Set(items.flatMap((p) => Object.keys(p.specs)))];
  const rows: { label: string; render: (p: ProductCardData) => React.ReactNode }[] = [
    { label: "Price", render: (p) => <Price value={p.price} compareAt={p.compareAtPrice} size="sm" /> },
    { label: "Rating", render: (p) => (p.ratingCount ? <Stars value={p.ratingAvg} count={p.ratingCount} /> : "—") },
    { label: "Brand", render: (p) => p.brand },
    { label: "Materials", render: (p) => p.materials || "—" },
    { label: "Dimensions", render: (p) => p.dimensions || "—" },
    { label: "Availability", render: (p) => (p.totalStock > 0 ? `${p.totalStock} in stock` : "Sold out") },
    ...specKeys.map((k) => ({ label: k, render: (p: ProductCardData) => p.specs[k] ?? "—" })),
  ];

  return (
    <Sheet open={open} onOpenChange={(o) => setPanel(o ? "compare" : null)} title="Compare products" side="bottom">
      <div className="overflow-auto p-4 sm:p-6">
        <table className="w-full min-w-[40rem] border-separate border-spacing-0 text-sm">
          <caption className="sr-only">Side-by-side product comparison</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 w-[9rem] bg-surface p-3 text-left font-normal text-subtle">
                Product
              </th>
              {items.map((p) => (
                <th key={p.id} scope="col" className="p-3 text-left align-top font-normal">
                  <div className="relative mb-2 aspect-square w-full max-w-[9rem] overflow-hidden rounded-md bg-white">
                    {p.images[0] && <Image src={p.images[0].src} alt="" fill sizes="9rem" className="object-cover" />}
                  </div>
                  <Link href={`/products/${p.slug}`} className="hover:underline" onClick={() => setPanel(null)}>
                    {p.name}
                  </Link>
                  <button type="button" onClick={() => toggle(p.id)} className="ml-2 inline-grid size-tap place-items-center rounded-full text-muted hover:text-fg" aria-label={`Remove ${p.name} from comparison`}>
                    <X className="size-4" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row" className="sticky left-0 z-10 border-t border-line bg-surface p-3 text-left font-normal text-subtle">
                  {r.label}
                </th>
                {items.map((p) => (
                  <td key={p.id} className="border-t border-line p-3 align-top">
                    {r.render(p)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Sheet>
  );
}
