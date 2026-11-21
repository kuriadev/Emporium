"use client";

import { useEffect, useState } from "react";
import { SectionHeading } from "@/components/ui/bits";
import type { ProductCardData } from "@/lib/types";
import { productsByIdsAction } from "@/server/actions/shop";
import { usePrefs } from "@/stores/prefs";
import { ProductRail } from "./product-rail";

export function TrackView({ productId }: { productId: string }) {
  const track = usePrefs((s) => s.trackView);
  useEffect(() => track(productId), [productId, track]);
  return null;
}

export function RecentlyViewed({ excludeId, title = "Recently viewed" }: { excludeId?: string; title?: string }) {
  const ids = usePrefs((s) => s.recentlyViewed);
  const [items, setItems] = useState<ProductCardData[]>([]);
  const key = ids.filter((id) => id !== excludeId).join(",");

  useEffect(() => {
    const list = key ? key.split(",") : [];
    if (!list.length) {
      setItems([]);
      return;
    }
    let alive = true;
    void productsByIdsAction(list).then((r) => alive && setItems(r));
    return () => {
      alive = false;
    };
  }, [key]);

  if (items.length === 0) return null;
  return (
    <section aria-labelledby="recent-title" className="space-y-6">
      <SectionHeading id="recent-title" title={title} accent="Pick up where you left off." />
      <ProductRail products={items} label={title} />
    </section>
  );
}
