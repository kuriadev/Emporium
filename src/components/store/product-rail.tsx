"use client";

import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { useRef } from "react";
import type { ProductCardData } from "@/lib/types";
import { ProductCard } from "./product-card";

/** Horizontally scrollable product row with scroll-snap (swipe on touch) and Figma's « » arrows. */
export function ProductRail({ products, label }: { products: ProductCardData[]; label: string }) {
  const ref = useRef<HTMLUListElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: reduce ? "auto" : "smooth" });
  };
  return (
    <div className="relative">
      <ul ref={ref} aria-label={label} className="-mx-gutter flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-gutter px-gutter pb-2 [scrollbar-width:none]">
        {products.map((p, i) => (
          <li key={p.id} className="w-[min(82vw,22rem)] shrink-0 snap-start">
            <ProductCard product={p} priority={i < 2} className="h-full" />
          </li>
        ))}
      </ul>
      {products.length > 3 && (
        <div className="pointer-events-none absolute inset-y-0 -left-2 -right-2 hidden items-center justify-between md:flex">
          <RailBtn label={`Scroll ${label} left`} onClick={() => scroll(-1)}>
            <ChevronsLeft className="size-5" />
          </RailBtn>
          <RailBtn label={`Scroll ${label} right`} onClick={() => scroll(1)}>
            <ChevronsRight className="size-5" />
          </RailBtn>
        </div>
      )}
    </div>
  );
}

function RailBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="pointer-events-auto grid size-tap place-items-center rounded-full border border-line bg-black/70 text-muted backdrop-blur transition hover:border-fg hover:text-fg active:scale-90">
      {children}
    </button>
  );
}
