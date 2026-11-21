import { sanitizeText } from "@/lib/security/sanitize";
import type { CategoryKey } from "@/lib/types";

export const CATEGORY_KEYS = ["gadgets", "furniture", "accessories", "clothes"] as const satisfies readonly CategoryKey[];
export const SORT_KEYS = ["featured", "price-asc", "price-desc", "newest", "best-selling", "rating"] as const;
export type CatalogSort = (typeof SORT_KEYS)[number];
export const SORT_LABELS: Record<CatalogSort, string> = {
  featured: "Featured",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
  newest: "Newest",
  "best-selling": "Best Selling",
  rating: "Top Rated",
};
export const PAGE_SIZE = 12;

const MAX_PESOS = 10_000_000;

export interface CatalogQuery {
  q: string;
  categories: CategoryKey[];
  colors: string[];
  /** Pesos as typed by the shopper; converted to centavos only when querying. */
  min: number | null;
  max: number | null;
  inStock: boolean;
  onSale: boolean;
  minRating: number | null;
  sort: CatalogSort | null;
  page: number;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? "") : (v ?? "")).slice(0, 400);
const list = (v: string | string[] | undefined): string[] =>
  one(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

function int(v: string | string[] | undefined, lo: number, hi: number): number | null {
  const raw = one(v);
  if (!/^\d{1,9}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= lo && n <= hi ? n : null;
}

const isCategory = (v: string): v is CategoryKey => (CATEGORY_KEYS as readonly string[]).includes(v);
const isSort = (v: string): v is CatalogSort => (SORT_KEYS as readonly string[]).includes(v);

/**
 * Parses untrusted URL search params into a whitelisted catalogue query. Unknown values are
 * dropped rather than rejected so a hand-edited or stale URL still renders something useful.
 */
export function parseCatalogQuery(sp: RawSearchParams): CatalogQuery {
  let min = int(sp.min, 0, MAX_PESOS);
  let max = int(sp.max, 0, MAX_PESOS);
  if (min !== null && max !== null && min > max) [min, max] = [max, min];
  const sort = one(sp.sort);
  return {
    q: sanitizeText(one(sp.q)).slice(0, 80),
    categories: [...new Set(list(sp.category).filter(isCategory))],
    colors: [...new Set(list(sp.color).filter((c) => /^[\p{L}][\p{L} -]{0,29}$/u.test(c)))].slice(0, 10),
    min,
    max,
    inStock: one(sp.stock) === "1",
    onSale: one(sp.sale) === "1",
    minRating: int(sp.rating, 1, 5),
    sort: isSort(sort) ? sort : null,
    page: int(sp.page, 1, 500) ?? 1,
  };
}

/** Serialises a query back to a canonical URL (stable key order, defaults omitted). */
export function catalogHref(query: Partial<CatalogQuery>): string {
  const p = new URLSearchParams();
  if (query.q) p.set("q", query.q);
  if (query.categories?.length) p.set("category", query.categories.join(","));
  if (query.colors?.length) p.set("color", query.colors.join(","));
  if (query.min !== null && query.min !== undefined) p.set("min", String(query.min));
  if (query.max !== null && query.max !== undefined) p.set("max", String(query.max));
  if (query.inStock) p.set("stock", "1");
  if (query.onSale) p.set("sale", "1");
  if (query.minRating) p.set("rating", String(query.minRating));
  if (query.sort && query.sort !== "featured") p.set("sort", query.sort);
  if (query.page && query.page > 1) p.set("page", String(query.page));
  const s = p.toString();
  return s ? `/products?${s}` : "/products";
}

export function activeFilterCount(q: CatalogQuery): number {
  return q.categories.length + q.colors.length + (q.min !== null || q.max !== null ? 1 : 0) + (q.inStock ? 1 : 0) + (q.onSale ? 1 : 0) + (q.minRating ? 1 : 0);
}
