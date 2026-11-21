"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type KeyboardEvent } from "react";
import type { CategoryKey, ProductCardData } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ProductCard } from "./product-card";

export interface CategoryTab {
  key: "all" | CategoryKey;
  label: string;
  blurb: string;
}

/** Figma's category rows collapsed into one tabbed grid: switching aisles re-flows cards with shared-layout motion. */
export function CategoryTabs({ products, tabs }: { products: ProductCardData[]; tabs: CategoryTab[] }) {
  const [active, setActive] = useState<CategoryTab["key"]>("all");
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = tabs.find((t) => t.key === active) ?? tabs[0]!;
  const shown = active === "all" ? products : products.filter((p) => p.category === active);

  const onKey = (e: KeyboardEvent, i: number) => {
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const idx = (next + tabs.length) % tabs.length;
    setActive(tabs[idx]!.key);
    refs.current[idx]?.focus();
  };

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Filter by category" className="-mx-gutter flex gap-2 overflow-x-auto px-gutter pb-1 [scrollbar-width:none]">
        {tabs.map((t, i) => {
          const on = t.key === active;
          const count = t.key === "all" ? products.length : products.filter((p) => p.category === t.key).length;
          return (
            <button
              key={t.key}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={on}
              aria-controls="category-panel"
              tabIndex={on ? 0 : -1}
              onKeyDown={(e) => onKey(e, i)}
              onClick={() => setActive(t.key)}
              className={cn("relative inline-flex min-h-tap shrink-0 items-center gap-2 rounded-pill border px-5 text-sm transition-colors", on ? "border-transparent text-bg" : "border-line text-muted hover:border-line-strong hover:text-fg")}
            >
              {on && <motion.span layoutId="cat-pill" className="absolute inset-0 rounded-pill bg-fg" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
              <span className="relative">{t.label}</span>
              <span className={cn("relative text-2xs tabular-nums", on ? "text-bg/60" : "text-subtle")}>{count}</span>
            </button>
          );
        })}
      </div>

      <div id="category-panel" role="tabpanel" aria-labelledby={`tab-${current.key}`} className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted">{current.blurb}</p>
          <Link href={current.key === "all" ? "/products" : `/products?category=${current.key}`} className="group inline-flex min-h-tap items-center gap-2 text-sm text-muted hover:text-fg">
            {current.key === "all" ? "Browse the full store" : `All ${current.label.toLowerCase()}`}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
          </Link>
        </div>
        <motion.ul layout className="grid grid-cols-1 gap-4 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence mode="popLayout" initial={false}>
            {shown.map((p, i) => (
              <motion.li
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ type: "spring", stiffness: 380, damping: 32, delay: Math.min(i, 6) * 0.03 }}
              >
                <ProductCard product={p} className="h-full" />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      </div>
    </div>
  );
}
