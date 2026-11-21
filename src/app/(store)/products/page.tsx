import { ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActiveFilters, CatalogNav, FilterPanel, MobileFilters, PendingRegion, SortSelect } from "@/components/store/catalog-controls";
import { ProductCard } from "@/components/store/product-card";
import { buttonVariants } from "@/components/ui/button-variants";
import { activeFilterCount, catalogHref, PAGE_SIZE, parseCatalogQuery, type CatalogQuery, type RawSearchParams } from "@/lib/catalog-query";
import { cn } from "@/lib/utils";
import { limiters } from "@/server/security/limiters";
import { clientIp } from "@/server/security/request";
import { CATEGORY_META } from "@/server/db/catalog-data";
import { catalogFacets, getFeatured, listProducts, suggest } from "@/server/services/catalog";

type Props = { searchParams: Promise<RawSearchParams> };

function heading(q: CatalogQuery): string {
  if (q.q) return `Results for “${q.q}”`;
  if (q.onSale && !q.categories.length) return "On sale";
  if (q.categories.length === 1) return CATEGORY_META[q.categories[0]!].label;
  if (q.sort === "newest" && !q.categories.length) return "New arrivals";
  return "All products";
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = parseCatalogQuery(await searchParams);
  const title = heading(q);
  const category = q.categories.length === 1 ? q.categories[0]! : null;
  return {
    title,
    description: category ? CATEGORY_META[category].blurb : "Browse gadgets, home pieces, accessories and clothes with fast filters and honest prices.",
    // Faceted and search URLs are not canonical pages; point crawlers to the category (or the catalogue root).
    alternates: { canonical: category ? `/products?category=${category}` : "/products" },
    robots: q.q || activeFilterCount(q) > (category ? 1 : 0) ? { index: false, follow: true } : undefined,
  };
}

export default async function ProductsPage({ searchParams }: Props) {
  const query = parseCatalogQuery(await searchParams);
  const results = listProducts({
    q: query.q || undefined,
    categories: query.categories,
    colors: query.colors,
    minPrice: query.min !== null ? query.min * 100 : undefined,
    maxPrice: query.max !== null ? query.max * 100 : undefined,
    inStock: query.inStock,
    onSale: query.onSale,
    minRating: query.minRating ?? undefined,
    sort: query.sort ?? undefined,
  });
  const facets = catalogFacets();
  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const page = Math.min(query.page, pages);
  const visible = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Committed searches feed the admin "zero-result searches" report; typeahead keystrokes don't.
  let recovery: ReturnType<typeof suggest> | null = null;
  if (query.q) {
    const allowed = limiters.search.hit(await clientIp()).ok;
    recovery = suggest(query.q, { record: allowed && page === 1 });
  }
  const popular = results.length === 0 ? getFeatured(4) : [];
  const filtersOn = activeFilterCount(query) > 0;

  return (
    <CatalogNav query={query}>
      <div className="shell py-8 lg:py-12">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-subtle">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="hover:text-fg">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link href="/products" className="hover:text-fg" aria-current={query.categories.length || query.q ? undefined : "page"}>
                Store
              </Link>
            </li>
            {query.categories.length === 1 && (
              <>
                <li aria-hidden>/</li>
                <li aria-current="page" className="text-muted">
                  {CATEGORY_META[query.categories[0]!].label}
                </li>
              </>
            )}
          </ol>
        </nav>

        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-light">{heading(query)}</h1>
            <p className="mt-1 text-sm text-muted" role="status" aria-live="polite">
              {results.length} {results.length === 1 ? "product" : "products"}
              {pages > 1 && ` · page ${page} of ${pages}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <MobileFilters facets={facets} total={results.length} />
            <SortSelect />
          </div>
        </header>

        <div className="mt-5">
          <ActiveFilters facets={facets} />
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <aside aria-label="Filters" className="hidden lg:block">
            <div className="sticky top-24">
              <FilterPanel key={`${query.min}-${query.max}`} facets={facets} />
            </div>
          </aside>

          <PendingRegion>
            {visible.length > 0 ? (
              <ul className="grid grid-cols-1 gap-4 xs:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {visible.map((p, i) => (
                  <li key={p.id}>
                    <ProductCard product={p} priority={i < 4} className="h-full" />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-xl border border-dashed border-line-strong p-8 text-center md:p-12">
                <SearchX className="mx-auto size-10 text-subtle" aria-hidden />
                <h2 className="mt-4 text-2xl font-light">{query.q ? `No matches for “${query.q}”` : "Nothing matches these filters"}</h2>
                {recovery?.didYouMean && (
                  <p className="mt-3 text-muted">
                    Did you mean{" "}
                    <Link className="text-accent underline underline-offset-4" href={catalogHref({ q: recovery.didYouMean })}>
                      {recovery.didYouMean}
                    </Link>
                    ?
                  </p>
                )}
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  {filtersOn && (
                    <Link href={catalogHref({ q: query.q })} className={buttonVariants({ variant: "outline" })}>
                      Keep the search, drop filters
                    </Link>
                  )}
                  <Link href="/products" className={buttonVariants()}>
                    Browse everything
                  </Link>
                </div>
                {recovery && recovery.trending.length > 0 && (
                  <div className="mt-8">
                    <p className="text-2xs uppercase tracking-[0.25em] text-subtle">People are searching for</p>
                    <ul className="mt-3 flex flex-wrap justify-center gap-2">
                      {recovery.trending.map((t) => (
                        <li key={t}>
                          <Link href={catalogHref({ q: t })} className="inline-flex min-h-[2.25rem] pointer-coarse:min-h-tap items-center rounded-pill border border-line px-3 text-sm text-muted hover:border-fg hover:text-fg">
                            {t}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {popular.length > 0 && (
              <section aria-labelledby="popular-title" className="mt-12 space-y-5">
                <h2 id="popular-title" className="text-xl">
                  Popular right now
                </h2>
                <ul className="grid grid-cols-1 gap-4 xs:grid-cols-2 xl:grid-cols-4">
                  {popular.map((p) => (
                    <li key={p.id}>
                      <ProductCard product={p} className="h-full" />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {pages > 1 && (
              <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-2">
                <PageLink query={query} page={page - 1} disabled={page <= 1} label="Previous page">
                  <ChevronLeft className="size-5" />
                </PageLink>
                {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                  <Link
                    key={n}
                    href={catalogHref({ ...query, page: n })}
                    aria-current={n === page ? "page" : undefined}
                    className={cn("grid size-tap place-items-center rounded-full text-sm transition", n === page ? "bg-fg text-bg" : "text-muted hover:bg-white/10 hover:text-fg")}
                  >
                    {n}
                  </Link>
                ))}
                <PageLink query={query} page={page + 1} disabled={page >= pages} label="Next page">
                  <ChevronRight className="size-5" />
                </PageLink>
              </nav>
            )}
          </PendingRegion>
        </div>
      </div>
    </CatalogNav>
  );
}

function PageLink({ query, page, disabled, label, children }: { query: CatalogQuery; page: number; disabled: boolean; label: string; children: React.ReactNode }) {
  if (disabled)
    return (
      <span aria-hidden className="grid size-tap place-items-center rounded-full text-subtle/40">
        {children}
      </span>
    );
  return (
    <Link href={catalogHref({ ...query, page })} aria-label={label} className="grid size-tap place-items-center rounded-full border border-line text-muted transition hover:border-fg hover:text-fg">
      {children}
    </Link>
  );
}
