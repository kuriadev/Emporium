"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Heart, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import type { ProductCardData } from "@/lib/types";
import { useCart } from "@/stores/cart";
import { ProductCard } from "./product-card";

export function WishlistGrid({ initial }: { initial: ProductCardData[] }) {
  const wishlist = useCart((s) => s.wishlist);
  const hydrated = useCart((s) => s.cart !== null);
  const add = useCart((s) => s.add);
  const [moving, setMoving] = useState(false);
  // Before the store hydrates, trust the server list; afterwards, follow optimistic toggles so un-hearted items animate out.
  const items = hydrated ? initial.filter((p) => wishlist.includes(p.id)) : initial;
  const quickAddable = items.filter((p) => p.variantCount === 1 && p.defaultVariantId && p.totalStock > 0);

  if (items.length === 0)
    return (
      <div className="rounded-xl border border-dashed border-line-strong p-10 text-center">
        <Heart className="mx-auto size-10 text-subtle" aria-hidden />
        <h2 className="mt-4 text-2xl font-light">Nothing saved yet</h2>
        <p className="mt-2 text-muted">Tap the heart on any product to keep it here for later.</p>
        <Link href="/products" className={`${buttonVariants()} mt-6`}>
          Discover products
        </Link>
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted" role="status">
          {items.length} saved {items.length === 1 ? "item" : "items"}
        </p>
        {quickAddable.length > 0 && (
          <Button
            variant="outline"
            loading={moving}
            onClick={async () => {
              setMoving(true);
              let added = 0;
              for (const p of quickAddable) if (await add(p.defaultVariantId!, 1, { open: false })) added++;
              setMoving(false);
              if (added) toast.success(`${added} ${added === 1 ? "item" : "items"} added to your bag`);
            }}
          >
            <ShoppingBag className="size-4" aria-hidden /> Add {quickAddable.length === items.length ? "all" : "ready items"} to bag
          </Button>
        )}
      </div>
      <motion.ul layout className="grid grid-cols-1 gap-4 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <AnimatePresence mode="popLayout">
          {items.map((p) => (
            <motion.li key={p.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: "spring", stiffness: 380, damping: 32 }}>
              <ProductCard product={p} className="h-full" />
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>
    </div>
  );
}
