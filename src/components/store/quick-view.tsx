"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { create } from "zustand";
import { Skeleton, Stars } from "@/components/ui/bits";
import { Modal } from "@/components/ui/overlay";
import type { ProductDetail } from "@/lib/types";
import { quickViewAction } from "@/server/actions/shop";
import { AddToBag, SelectedPrice, useVariantSelection, VariantOptions } from "./purchase";

export const useQuickView = create<{ slug: string | null; show: (slug: string) => void; hide: () => void }>((set) => ({
  slug: null,
  show: (slug) => set({ slug }),
  hide: () => set({ slug: null }),
}));

export function QuickView() {
  const slug = useQuickView((s) => s.slug);
  const hide = useQuickView((s) => s.hide);
  const [product, setProduct] = useState<ProductDetail | null>(null);

  useEffect(() => {
    setProduct(null);
    if (!slug) return;
    let alive = true;
    void quickViewAction(slug).then((p) => alive && setProduct(p));
    return () => {
      alive = false;
    };
  }, [slug]);

  return (
    <Modal open={!!slug} onOpenChange={(o) => !o && hide()} title={product?.name ?? "Quick view"} hideTitle>
      {!product ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full rounded-pill" />
          </div>
        </div>
      ) : (
        <QuickViewBody product={product} onAdded={hide} />
      )}
    </Modal>
  );
}

function QuickViewBody({ product, onAdded }: { product: ProductDetail; onAdded: () => void }) {
  const selection = useVariantSelection(product.variants);
  const [img, setImg] = useState(0);
  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <div>
        <div className="relative aspect-square overflow-hidden rounded-lg bg-white">
          <Image src={product.images[img]!.src} alt={product.images[img]!.alt} fill sizes="(min-width: 48rem) 26rem, 90vw" className="object-cover" />
        </div>
        <div className="mt-3 flex gap-2">
          {product.images.map((im, i) => (
            <button key={im.src} type="button" onClick={() => setImg(i)} aria-label={`Show image ${i + 1}`} aria-current={i === img} className={`relative size-16 overflow-hidden rounded-sm bg-white ring-offset-2 ring-offset-bg ${i === img ? "ring-2 ring-fg" : "opacity-60"}`}>
              <Image src={im.src} alt="" fill sizes="4rem" className="object-cover" />
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-2xs uppercase tracking-[0.25em] text-subtle">{product.brand}</p>
          <h2 className="mt-1 text-3xl font-normal">{product.name}</h2>
          <p className="mt-2 text-muted">{product.tagline}</p>
          {product.ratingCount > 0 && <Stars className="mt-2" value={product.ratingAvg} count={product.ratingCount} />}
        </div>
        <SelectedPrice variant={selection.selected} compareAt={product.compareAtPrice} />
        <VariantOptions {...selection} />
        <AddToBag variant={selection.selected} productName={product.name} onAdded={onAdded} />
        <Link href={`/products/${product.slug}`} className="text-sm text-accent underline-offset-4 hover:underline" onClick={onAdded}>
          View full details, specs and reviews
        </Link>
      </div>
    </div>
  );
}
