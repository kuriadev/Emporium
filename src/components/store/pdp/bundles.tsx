"use client";

import { Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Money } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import type { ProductCardData } from "@/lib/types";
import { useCart } from "@/stores/cart";

export interface BundleView {
  id: string;
  title: string;
  pct: number;
  items: ProductCardData[];
  full: number;
  savings: number;
}

/** Frequently bought together: one-tap bundle add, discount applied server-side when every item is in the bag. */
export function Bundles({ bundles }: { bundles: BundleView[] }) {
  const addBundle = useCart((s) => s.addBundle);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  if (!bundles.length) return null;

  return (
    <section aria-labelledby="fbt-title" className="space-y-6">
      <h2 id="fbt-title" className="text-2xl font-medium">
        Frequently bought together <span className="font-light text-muted">Bundle and save.</span>
      </h2>
      <ul className="grid gap-4 lg:grid-cols-2">
        {bundles.map((b) => {
          const ids = b.items.map((p) => p.defaultVariantId).filter((x): x is string => !!x);
          const usesDefaults = b.items.some((p) => p.variantCount > 1);
          return (
            <li key={b.id} className="flex flex-col gap-5 rounded-xl border border-line bg-surface/60 p-5 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                {b.items.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-2">
                    {i > 0 && <Plus className="size-4 text-subtle" aria-hidden />}
                    <Link href={`/products/${p.slug}`} className="relative block size-20 overflow-hidden rounded-md bg-white" aria-label={p.name}>
                      {p.images[0] && <Image src={p.images[0].src} alt="" fill sizes="5rem" className="object-cover" />}
                    </Link>
                  </div>
                ))}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-lg">{b.title}</p>
                <p className="flex flex-wrap items-baseline gap-2 text-sm">
                  <span className="text-lg text-price">
                    <Money value={b.full - b.savings} />
                  </span>
                  <s className="text-subtle">
                    <Money value={b.full} />
                  </s>
                  <span className="rounded-pill bg-price/15 px-2 py-0.5 text-2xs uppercase tracking-wider text-price">Save {b.pct}%</span>
                </p>
                {usesDefaults && <p className="text-xs text-subtle">Adds the first in-stock option of each item.</p>}
              </div>
              <Button
                variant="outline"
                loading={busy === b.id}
                success={done === b.id}
                disabled={ids.length !== b.items.length}
                onClick={async () => {
                  setBusy(b.id);
                  const ok = await addBundle(ids);
                  setBusy(null);
                  if (ok) {
                    setDone(b.id);
                    setTimeout(() => setDone(null), 1000);
                  }
                }}
              >
                Add bundle
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
