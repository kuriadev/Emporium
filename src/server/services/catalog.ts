import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { SORT_LABELS, type CatalogSort } from "@/lib/catalog-query";
import { renderSafeMarkdown } from "@/lib/security/sanitize";
import { didYouMean, normalizeQuery, scoreMatch } from "@/lib/search";
import type { CategoryKey, ProductCardData, ProductDetail, SearchSuggestion, VariantView } from "@/lib/types";
import { getDb, schema } from "../db";
import { BUNDLES, CATEGORY_META } from "../db/catalog-data";

export const SORTS = SORT_LABELS;
export type SortKey = CatalogSort;

export interface CatalogFilters {
  q?: string;
  categories?: CategoryKey[];
  colors?: string[];
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  onSale?: boolean;
  minRating?: number;
  sort?: SortKey;
}

type ProductRow = schema.Product;
type VariantRow = schema.ProductVariant;

export const variantPrice = (p: Pick<ProductRow, "basePrice">, v: Pick<VariantRow, "priceOverride">) => v.priceOverride ?? p.basePrice;

function toCard(p: ProductRow, variants: VariantRow[]): ProductCardData {
  const prices = variants.map((v) => variantPrice(p, v));
  const swatchMap = new Map<string, string>();
  for (const v of variants) if (v.color && v.colorHex) swatchMap.set(v.color, v.colorHex);
  const firstInStock = variants.find((v) => v.stock > 0) ?? variants[0];
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    category: p.category,
    tagline: p.tagline,
    price: prices.length ? Math.min(...prices) : p.basePrice,
    compareAtPrice: p.compareAtPrice,
    images: p.images,
    ratingAvg: p.ratingAvg,
    ratingCount: p.ratingCount,
    totalStock: variants.reduce((a, v) => a + v.stock, 0),
    swatches: [...swatchMap].map(([color, hex]) => ({ color, hex })),
    soldCount: p.soldCount,
    createdAt: p.createdAt.getTime(),
    defaultVariantId: firstInStock?.id ?? null,
    variantCount: variants.length,
    tierPricing: p.tierPricing,
    materials: p.materials,
    dimensions: p.dimensions,
    specs: p.specs,
  };
}

function loadActive(ids?: string[]): ProductCardData[] {
  const db = getDb();
  const where = ids ? and(eq(schema.products.status, "active"), inArray(schema.products.id, ids)) : eq(schema.products.status, "active");
  const products = db.select().from(schema.products).where(where).all();
  if (!products.length) return [];
  const variants = db.select().from(schema.productVariants).where(inArray(schema.productVariants.productId, products.map((p) => p.id))).all();
  const byProduct = Map.groupBy(variants, (v) => v.productId);
  return products.map((p) => toCard(p, byProduct.get(p.id) ?? []));
}

export function listProducts(filters: CatalogFilters = {}): ProductCardData[] {
  // In-memory faceting is fine for a boutique catalogue; move to SQL/FTS5 once SKUs reach the thousands.
  let items = loadActive();
  const colorSet = filters.colors?.length ? new Set(filters.colors.map((c) => c.toLowerCase())) : null;

  if (filters.q) {
    const q = filters.q;
    items = items
      .map((p) => ({ p, s: scoreMatch(q, `${p.name} ${p.brand} ${p.category} ${p.tagline} ${p.materials}`) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.p);
  }
  if (filters.categories?.length) items = items.filter((p) => filters.categories!.includes(p.category));
  if (colorSet) items = items.filter((p) => p.swatches.some((s) => colorSet.has(s.color.toLowerCase())));
  if (filters.minPrice !== undefined) items = items.filter((p) => p.price >= filters.minPrice!);
  if (filters.maxPrice !== undefined) items = items.filter((p) => p.price <= filters.maxPrice!);
  if (filters.inStock) items = items.filter((p) => p.totalStock > 0);
  if (filters.onSale) items = items.filter((p) => p.compareAtPrice !== null && p.compareAtPrice > p.price);
  if (filters.minRating) items = items.filter((p) => p.ratingAvg >= filters.minRating!);

  const sorters: Record<SortKey, (a: ProductCardData, b: ProductCardData) => number> = {
    featured: (a, b) => b.soldCount * (b.ratingAvg || 1) - a.soldCount * (a.ratingAvg || 1),
    "price-asc": (a, b) => a.price - b.price,
    "price-desc": (a, b) => b.price - a.price,
    newest: (a, b) => b.createdAt - a.createdAt,
    "best-selling": (a, b) => b.soldCount - a.soldCount,
    rating: (a, b) => b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount,
  };
  if (!filters.q || filters.sort) items = [...items].sort(sorters[filters.sort ?? "featured"]);
  return items;
}

export function catalogFacets() {
  const items = loadActive();
  const colors = new Map<string, string>();
  for (const p of items) for (const s of p.swatches) colors.set(s.color, s.hex);
  const prices = items.map((p) => p.price);
  return {
    categories: (Object.keys(CATEGORY_META) as CategoryKey[]).map((key) => ({
      key,
      label: CATEGORY_META[key].label,
      count: items.filter((p) => p.category === key).length,
    })),
    colors: [...colors].map(([color, hex]) => ({ color, hex })),
    priceMin: prices.length ? Math.min(...prices) : 0,
    priceMax: prices.length ? Math.max(...prices) : 0,
  };
}

export function getFeatured(limit = 8): ProductCardData[] {
  return listProducts({ sort: "featured" }).slice(0, limit);
}

export function getByCategory(category: CategoryKey): ProductCardData[] {
  return listProducts({ categories: [category], sort: "best-selling" });
}

export function getProductsByIds(ids: string[]): ProductCardData[] {
  if (!ids.length) return [];
  const map = new Map(loadActive(ids).map((p) => [p.id, p]));
  return ids.map((id) => map.get(id)).filter((p): p is ProductCardData => !!p);
}

export function getProductBySlug(slug: string): ProductDetail | null {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const db = getDb();
  const p = db.select().from(schema.products).where(and(eq(schema.products.slug, slug), eq(schema.products.status, "active"))).get();
  if (!p) return null;
  const variants = db.select().from(schema.productVariants).where(eq(schema.productVariants.productId, p.id)).all();
  const card = toCard(p, variants);
  return {
    ...card,
    description: p.description,
    descriptionHtml: renderSafeMarkdown(p.description),
    weightGrams: p.weightGrams,
    variants: variants.map(
      (v): VariantView => ({ id: v.id, sku: v.sku, color: v.color, colorHex: v.colorHex, size: v.size, material: v.material, price: variantPrice(p, v), stock: v.stock }),
    ),
  };
}

export function getBundlesFor(productId: string) {
  const relevant = BUNDLES.filter((b) => b.productIds.includes(productId));
  if (!relevant.length) return [];
  const products = new Map(getProductsByIds([...new Set(relevant.flatMap((b) => b.productIds))]).map((p) => [p.id, p]));
  return relevant
    .map((b) => {
      const items = b.productIds.map((id) => products.get(id)).filter((p): p is ProductCardData => !!p);
      const full = items.reduce((a, p) => a + p.price, 0);
      return { id: b.id, title: b.title, pct: b.pct, items, full, savings: Math.floor((full * b.pct) / 100), complete: items.length === b.productIds.length };
    })
    .filter((b) => b.complete && b.items.every((p) => p.totalStock > 0));
}

export function getRelated(product: Pick<ProductCardData, "id" | "category">, limit = 4): ProductCardData[] {
  const all = listProducts({ sort: "best-selling" }).filter((p) => p.id !== product.id);
  return [...all.filter((p) => p.category === product.category), ...all.filter((p) => p.category !== product.category)].slice(0, limit);
}

export function getReviews(productId: string, rating?: number) {
  const db = getDb();
  const where = rating ? and(eq(schema.reviews.productId, productId), eq(schema.reviews.rating, rating)) : eq(schema.reviews.productId, productId);
  const list = db.select().from(schema.reviews).where(where).orderBy(desc(schema.reviews.verified), desc(schema.reviews.createdAt)).limit(50).all();
  const histogramRows = db
    .select({ rating: schema.reviews.rating, n: sql<number>`count(*)` })
    .from(schema.reviews)
    .where(eq(schema.reviews.productId, productId))
    .groupBy(schema.reviews.rating)
    .all();
  const histogram = [5, 4, 3, 2, 1].map((r) => ({ rating: r, count: histogramRows.find((h) => h.rating === r)?.n ?? 0 }));
  return { list, histogram };
}

const TRENDING_FALLBACK = ["airpods", "jacket", "iphone", "watch"];

export function trendingQueries(limit = 5): string[] {
  const db = getDb();
  const rows = db
    .select({ query: schema.searchQueries.query, n: sql<number>`count(*)` })
    .from(schema.searchQueries)
    .where(and(gte(schema.searchQueries.resultCount, 1), gte(schema.searchQueries.createdAt, new Date(Date.now() - 14 * 86_400_000))))
    .groupBy(schema.searchQueries.query)
    .orderBy(desc(sql`count(*)`))
    .limit(limit)
    .all();
  return rows.length ? rows.map((r) => r.query) : TRENDING_FALLBACK;
}

export function suggest(rawQuery: string, { record = true }: { record?: boolean } = {}): SearchSuggestion {
  const q = normalizeQuery(rawQuery);
  const trending = trendingQueries();
  if (q.length < 2) return { products: [], categories: [], didYouMean: null, trending, total: 0 };

  const results = listProducts({ q });
  const categories = (Object.keys(CATEGORY_META) as CategoryKey[])
    .filter((key) => scoreMatch(q, `${key} ${CATEGORY_META[key].label}`) > 0)
    .map((key) => ({ key, label: CATEGORY_META[key].label }));

  if (record && q.length >= 3) {
    getDb().insert(schema.searchQueries).values({ id: randomUUID(), query: q, resultCount: results.length }).run();
  }

  const vocabulary = [...new Set(loadActive().flatMap((p) => [p.name, p.brand, ...p.name.split(" ")]).concat(Object.keys(CATEGORY_META)))];
  return {
    products: results.slice(0, 6).map(({ id, slug, name, brand, price, images, category }) => ({ id, slug, name, brand, price, images, category })),
    categories,
    didYouMean: results.length === 0 ? didYouMean(q, vocabulary) : null,
    trending,
    total: results.length,
  };
}

export function hasReviewed(userId: string, productId: string): boolean {
  return !!getDb()
    .select({ id: schema.reviews.id })
    .from(schema.reviews)
    .where(and(eq(schema.reviews.productId, productId), eq(schema.reviews.userId, userId)))
    .get();
}
