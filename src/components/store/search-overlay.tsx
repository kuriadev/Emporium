"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Loader2, Search, Sparkles, TrendingUp } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Money } from "@/components/ui/bits";
import { Modal } from "@/components/ui/overlay";
import type { ProductCardData, SearchSuggestion } from "@/lib/types";
import { searchAction } from "@/server/actions/shop";
import { useCart } from "@/stores/cart";

type Mini = Pick<ProductCardData, "id" | "slug" | "name" | "brand" | "price" | "images">;

export function SearchOverlay({ bestsellers }: { bestsellers: Mini[] }) {
  const open = useCart((s) => s.panel === "search");
  const setPanel = useCart((s) => s.setPanel);
  const router = useRouter();
  const [q, setQ] = useState("");
  const [result, setResult] = useState<SearchSuggestion | null>(null);
  const [pending, startTransition] = useTransition();
  const seq = useRef(0);

  useEffect(() => {
    if (!open) return;
    const id = ++seq.current;
    const t = setTimeout(() => {
      startTransition(async () => {
        const r = await searchAction(q);
        if (id === seq.current) setResult(r);
      });
    }, 180);
    return () => clearTimeout(t);
  }, [q, open]);

  const close = () => setPanel(null);
  const go = (href: string) => {
    close();
    router.push(href);
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) go(`/products?q=${encodeURIComponent(q.trim())}`);
  };

  const zero = result && q.trim().length >= 2 && result.total === 0;

  return (
    <Modal open={open} onOpenChange={(o) => setPanel(o ? "search" : null)} title="Search Emporium" hideTitle placement="top" className="max-w-[44rem]">
      <form onSubmit={submit} role="search" className="relative">
        <label htmlFor="site-search" className="sr-only">
          Search products, brands and categories
        </label>
        <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
        <input
          id="site-search"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Try “airpods”, “jacket” or “watch”"
          autoComplete="off"
          maxLength={80}
          className="min-h-[3.5rem] w-full rounded-lg border border-line-strong bg-surface/80 pl-12 pr-12 text-lg outline-none transition focus:border-accent focus:shadow-[0_0_0_0.3125rem_oklch(0.78_0.11_315/0.25)]"
        />
        {pending && <Loader2 className="absolute right-4 top-1/2 size-5 -translate-y-1/2 animate-spin text-muted" aria-hidden />}
      </form>

      <div className="mt-6 grid gap-6" aria-live="polite">
        {q.trim().length < 2 && result && (
          <Group icon={<TrendingUp className="size-4" />} title="Trending searches">
            <div className="flex flex-wrap gap-2">
              {result.trending.map((t) => (
                <button key={t} type="button" onClick={() => setQ(t)} className="min-h-tap rounded-pill border border-line px-4 text-sm text-muted transition hover:border-fg hover:text-fg">
                  {t}
                </button>
              ))}
            </div>
          </Group>
        )}

        {result && result.categories.length > 0 && (
          <Group title="Categories">
            <div className="flex flex-wrap gap-2">
              {result.categories.map((c) => (
                <button key={c.key} type="button" onClick={() => go(`/products?category=${c.key}`)} className="inline-flex min-h-tap items-center gap-2 rounded-pill bg-white/5 px-4 text-sm hover:bg-white/10">
                  {c.label} <ArrowRight className="size-4" />
                </button>
              ))}
            </div>
          </Group>
        )}

        <AnimatePresence mode="popLayout">
          {result && result.products.length > 0 && (
            <motion.div key="products" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Group title={`Products (${result.total})`}>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {result.products.map((p) => (
                    <li key={p.id}>
                      <ProductRow p={p} onClick={() => go(`/products/${p.slug}`)} />
                    </li>
                  ))}
                </ul>
                {result.total > result.products.length && (
                  <button type="button" onClick={() => go(`/products?q=${encodeURIComponent(q)}`)} className="mt-3 text-sm text-accent hover:underline">
                    See all {result.total} results
                  </button>
                )}
              </Group>
            </motion.div>
          )}
        </AnimatePresence>

        {zero && (
          <div className="space-y-6">
            <div className="rounded-md border border-line bg-surface/60 p-4">
              <p>No matches for “{q.trim()}”.</p>
              {result.didYouMean ? (
                <p className="mt-1 text-sm text-muted">
                  Did you mean{" "}
                  <button type="button" onClick={() => setQ(result.didYouMean!)} className="text-accent underline underline-offset-4">
                    {result.didYouMean}
                  </button>
                  ?
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted">Check the spelling, or browse a category below.</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {["gadgets", "furniture", "accessories", "clothes"].map((c) => (
                  <button key={c} type="button" onClick={() => go(`/products?category=${c}`)} className="min-h-tap rounded-pill border border-line px-4 text-sm capitalize hover:border-fg">
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <Group icon={<Sparkles className="size-4" />} title="Bestsellers you might like">
              <ul className="grid gap-2 sm:grid-cols-2">
                {bestsellers.map((p) => (
                  <li key={p.id}>
                    <ProductRow p={p} onClick={() => go(`/products/${p.slug}`)} />
                  </li>
                ))}
              </ul>
            </Group>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Group({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 text-2xs uppercase tracking-[0.25em] text-subtle">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function ProductRow({ p, onClick }: { p: Mini; onClick: () => void }) {
  return (
    <Link
      href={`/products/${p.slug}`}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className="flex items-center gap-3 rounded-md p-2 transition hover:bg-white/5"
    >
      <span className="relative size-14 shrink-0 overflow-hidden rounded-sm bg-white">
        {p.images[0] && <Image src={p.images[0].src} alt="" fill sizes="3.5rem" className="object-cover" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-1">{p.name}</span>
        <span className="text-xs text-muted">{p.brand}</span>
      </span>
      <span className="text-sm text-price">
        <Money value={p.price} />
      </span>
    </Link>
  );
}
