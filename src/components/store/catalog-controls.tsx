"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, SlidersHorizontal, Star, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, use, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Sheet } from "@/components/ui/overlay";
import { activeFilterCount, catalogHref, SORT_KEYS, SORT_LABELS, type CatalogQuery, type CatalogSort } from "@/lib/catalog-query";
import { formatMoney } from "@/lib/money";
import type { CategoryKey } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface Facets {
  categories: { key: CategoryKey; label: string; count: number }[];
  colors: { color: string; hex: string }[];
  priceMin: number;
  priceMax: number;
}

interface Nav {
  query: CatalogQuery;
  pending: boolean;
  apply: (patch: Partial<CatalogQuery>) => void;
}

const NavCtx = createContext<Nav | null>(null);
const useNav = () => {
  const ctx = use(NavCtx);
  if (!ctx) throw new Error("Catalog controls must be rendered inside <CatalogNav>");
  return ctx;
};

/**
 * Owns URL state for the catalogue. Every filter change is a router.replace inside a transition, so
 * the URL is always the source of truth (shareable, back-button friendly) and the grid dims while
 * the server renders the next result set.
 */
export function CatalogNav({ query, children }: { query: CatalogQuery; children: React.ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const apply = (patch: Partial<CatalogQuery>) => {
    const href = catalogHref({ ...query, page: 1, ...patch });
    start(() => router.replace(href, { scroll: false }));
  };
  return <NavCtx value={{ query, pending, apply }}>{children}</NavCtx>;
}

export function PendingRegion({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useNav();
  return (
    <div aria-busy={pending} className={cn("transition-opacity duration-200", pending && "pointer-events-none opacity-50", className)}>
      {children}
    </div>
  );
}

export function SortSelect() {
  const { query, apply } = useNav();
  return (
    <label className="flex items-center gap-3 text-sm text-muted">
      <span className="hidden sm:inline">Sort by</span>
      <span className="relative">
        <select
          value={query.sort ?? (query.q ? "" : "featured")}
          onChange={(e) => apply({ sort: (e.target.value || null) as CatalogSort | null })}
          className="min-h-tap cursor-pointer appearance-none rounded-pill border border-line bg-surface py-2 pl-4 pr-10 text-fg transition hover:border-line-strong focus-visible:border-accent"
          aria-label="Sort products"
        >
          {query.q && <option value="">Best match</option>}
          {SORT_KEYS.map((k) => (
            <option key={k} value={k}>
              {SORT_LABELS[k]}
            </option>
          ))}
        </select>
        <span aria-hidden className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs">
          ▾
        </span>
      </span>
    </label>
  );
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

const PRICE_PRESETS = [
  { label: "Under ₱500", min: null, max: 500 },
  { label: "₱500 to ₱10k", min: 500, max: 10_000 },
  { label: "₱10k and up", min: 10_000, max: null },
] as const;

export function FilterPanel({ facets, onDone }: { facets: Facets; onDone?: () => void }) {
  const { query, apply } = useNav();
  const [min, setMin] = useState(query.min?.toString() ?? "");
  const [max, setMax] = useState(query.max?.toString() ?? "");
  const [priceError, setPriceError] = useState<string>();
  const [shake, setShake] = useState(0);

  const submitPrice = (e: FormEvent) => {
    e.preventDefault();
    const lo = min === "" ? null : Number(min);
    const hi = max === "" ? null : Number(max);
    if ((lo !== null && (!Number.isInteger(lo) || lo < 0)) || (hi !== null && (!Number.isInteger(hi) || hi < 0))) {
      setPriceError("Use whole peso amounts, 0 or more.");
      setShake((n) => n + 1);
      return;
    }
    if (lo !== null && hi !== null && lo > hi) {
      setPriceError("Minimum must be lower than maximum.");
      setShake((n) => n + 1);
      return;
    }
    setPriceError(undefined);
    apply({ min: lo, max: hi });
    onDone?.();
  };

  return (
    <div className="space-y-8">
      <fieldset>
        <legend className="mb-3 text-2xs uppercase tracking-[0.25em] text-subtle">Category</legend>
        <ul className="space-y-1">
          {facets.categories.map((c) => {
            const on = query.categories.includes(c.key);
            return (
              <li key={c.key}>
                <label className="group flex min-h-tap cursor-pointer items-center gap-3 rounded-sm px-2 transition hover:bg-white/5">
                  <input type="checkbox" className="peer sr-only" checked={on} onChange={() => apply({ categories: toggle(query.categories, c.key) })} />
                  <span className={cn("grid size-5 place-items-center rounded-xs border transition peer-focus-visible:ring-[0.1875rem] peer-focus-visible:ring-accent", on ? "border-fg bg-fg text-bg" : "border-line-strong")}>
                    <AnimatePresence>{on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 800, damping: 18 }}><Check className="size-3.5" /></motion.span>}</AnimatePresence>
                  </span>
                  <span className="flex-1">{c.label}</span>
                  <span className="text-xs tabular-nums text-subtle">{c.count}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-2xs uppercase tracking-[0.25em] text-subtle">Price (₱)</legend>
        <div className="mb-3 flex flex-wrap gap-2">
          {PRICE_PRESETS.map((p) => {
            const on = query.min === p.min && query.max === p.max;
            return (
              <button
                key={p.label}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setMin(p.min?.toString() ?? "");
                  setMax(p.max?.toString() ?? "");
                  apply(on ? { min: null, max: null } : { min: p.min, max: p.max });
                }}
                className={cn("min-h-[2.25rem] pointer-coarse:min-h-tap rounded-pill border px-3 text-xs transition", on ? "border-fg bg-fg text-bg" : "border-line text-muted hover:border-line-strong hover:text-fg")}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <form onSubmit={submitPrice} noValidate className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Min" inputMode="numeric" placeholder={String(Math.floor(facets.priceMin / 100))} value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, "").slice(0, 8))} error={priceError ? " " : undefined} shakeKey={shake} />
            <Field label="Max" inputMode="numeric" placeholder={String(Math.ceil(facets.priceMax / 100))} value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, "").slice(0, 8))} error={priceError ? " " : undefined} shakeKey={shake} />
          </div>
          {priceError && (
            <p role="alert" className="text-sm text-danger">
              {priceError}
            </p>
          )}
          <p className="text-xs text-subtle">
            Range in store: {formatMoney(facets.priceMin)} to {formatMoney(facets.priceMax)}
          </p>
          <Button type="submit" variant="outline" size="sm" className="w-full">
            Apply price
          </Button>
        </form>
      </fieldset>

      {facets.colors.length > 0 && (
        <fieldset>
          <legend className="mb-3 text-2xs uppercase tracking-[0.25em] text-subtle">Colour</legend>
          <div className="flex flex-wrap gap-1">
            {facets.colors.map((c) => {
              const on = query.colors.some((x) => x.toLowerCase() === c.color.toLowerCase());
              return (
                <motion.button
                  key={c.color}
                  type="button"
                  whileTap={{ scale: 0.88 }}
                  aria-pressed={on}
                  aria-label={c.color}
                  title={c.color}
                  onClick={() => apply({ colors: on ? query.colors.filter((x) => x.toLowerCase() !== c.color.toLowerCase()) : [...query.colors, c.color] })}
                  className="grid size-tap place-items-center rounded-full"
                >
                  <span className={cn("size-7 rounded-full ring-1 ring-white/30 ring-offset-2 ring-offset-bg transition", on && "ring-2 ring-fg")} style={{ background: c.hex }} />
                </motion.button>
              );
            })}
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend className="mb-3 text-2xs uppercase tracking-[0.25em] text-subtle">Rating</legend>
        <div className="flex flex-wrap gap-2">
          {[4, 3].map((r) => {
            const on = query.minRating === r;
            return (
              <button
                key={r}
                type="button"
                aria-pressed={on}
                onClick={() => apply({ minRating: on ? null : r })}
                className={cn("inline-flex min-h-[2.25rem] pointer-coarse:min-h-tap items-center gap-1.5 rounded-pill border px-3 text-xs transition", on ? "border-fg bg-fg text-bg" : "border-line text-muted hover:border-line-strong hover:text-fg")}
              >
                <Star className={cn("size-3.5", on ? "fill-bg" : "fill-warning text-warning")} aria-hidden /> {r} and up
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-1">
        <legend className="mb-3 text-2xs uppercase tracking-[0.25em] text-subtle">Availability</legend>
        <Switch label="In stock only" checked={query.inStock} onChange={(v) => apply({ inStock: v })} />
        <Switch label="On sale" checked={query.onSale} onChange={(v) => apply({ onSale: v })} />
      </fieldset>
    </div>
  );
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-tap cursor-pointer items-center justify-between gap-3 rounded-sm px-2 transition hover:bg-white/5">
      <span>{label}</span>
      <input type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={cn("relative h-6 w-11 rounded-pill border transition-colors peer-focus-visible:ring-[0.1875rem] peer-focus-visible:ring-accent", checked ? "border-price bg-price/80" : "border-line-strong bg-surface-2")}>
        <motion.span layout transition={{ type: "spring", stiffness: 700, damping: 30 }} className={cn("absolute top-0.5 size-[1.125rem] rounded-full bg-fg shadow", checked ? "right-0.5" : "left-0.5")} />
      </span>
    </label>
  );
}

export function MobileFilters({ facets, total }: { facets: Facets; total: number }) {
  const { query, apply } = useNav();
  const [open, setOpen] = useState(false);
  const count = activeFilterCount(query);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="lg:hidden" aria-haspopup="dialog">
        <SlidersHorizontal className="size-4" aria-hidden /> Filters
        {count > 0 && <span className="grid min-w-5 place-items-center rounded-pill bg-fg px-1.5 text-2xs text-bg">{count}</span>}
      </Button>
      <Sheet open={open} onOpenChange={setOpen} side="bottom" title="Filters" description={`${total} matching products`}>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <FilterPanel facets={facets} onDone={() => setOpen(false)} />
        </div>
        <div className="flex gap-3 border-t border-line px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button variant="ghost" className="flex-1" onClick={() => apply({ categories: [], colors: [], min: null, max: null, inStock: false, onSale: false, minRating: null })} disabled={count === 0}>
            Clear all
          </Button>
          <Button className="flex-1" onClick={() => setOpen(false)}>
            Show {total} results
          </Button>
        </div>
      </Sheet>
    </>
  );
}

export function ActiveFilters({ facets }: { facets: Facets }) {
  const { query, apply } = useNav();
  const chips: { key: string; label: string; clear: Partial<CatalogQuery> }[] = [];
  if (query.q) chips.push({ key: "q", label: `“${query.q}”`, clear: { q: "" } });
  for (const c of query.categories) chips.push({ key: `c-${c}`, label: facets.categories.find((x) => x.key === c)?.label ?? c, clear: { categories: query.categories.filter((x) => x !== c) } });
  for (const c of query.colors) chips.push({ key: `col-${c}`, label: c, clear: { colors: query.colors.filter((x) => x !== c) } });
  if (query.min !== null || query.max !== null)
    chips.push({
      key: "price",
      label: query.min !== null && query.max !== null ? `₱${query.min.toLocaleString()} to ₱${query.max.toLocaleString()}` : query.min !== null ? `From ₱${query.min.toLocaleString()}` : `Up to ₱${query.max!.toLocaleString()}`,
      clear: { min: null, max: null },
    });
  if (query.minRating) chips.push({ key: "rating", label: `${query.minRating}★ and up`, clear: { minRating: null } });
  if (query.inStock) chips.push({ key: "stock", label: "In stock", clear: { inStock: false } });
  if (query.onSale) chips.push({ key: "sale", label: "On sale", clear: { onSale: false } });
  if (!chips.length) return null;

  return (
    <ul className="flex flex-wrap items-center gap-2" aria-label="Active filters">
      <AnimatePresence initial={false}>
        {chips.map((c) => (
          <motion.li key={c.key} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ type: "spring", stiffness: 600, damping: 30 }}>
            <button type="button" onClick={() => apply(c.clear)} className="inline-flex min-h-[2.25rem] pointer-coarse:min-h-tap items-center gap-1.5 rounded-pill border border-line-strong bg-surface px-3 text-sm transition hover:border-danger hover:text-danger" aria-label={`Remove filter ${c.label}`}>
              {c.label} <X className="size-3.5" aria-hidden />
            </button>
          </motion.li>
        ))}
      </AnimatePresence>
      <li>
        <button type="button" onClick={() => apply({ q: "", categories: [], colors: [], min: null, max: null, inStock: false, onSale: false, minRating: null })} className="min-h-[2.25rem] pointer-coarse:min-h-tap px-2 text-sm text-muted underline-offset-4 hover:text-fg hover:underline">
          Clear all
        </button>
      </li>
    </ul>
  );
}
