import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bundles } from "@/components/store/pdp/bundles";
import { BuyBox, type DeliveryEstimate } from "@/components/store/pdp/buy-box";
import { Gallery } from "@/components/store/pdp/gallery";
import { InfoTabs, type SpecRow } from "@/components/store/pdp/info-tabs";
import { Reviews, type ReviewEligibility } from "@/components/store/pdp/reviews";
import { ProductRail } from "@/components/store/product-rail";
import { RecentlyViewed, TrackView } from "@/components/store/recently-viewed";
import { SectionHeading } from "@/components/ui/bits";
import { formatDate } from "@/lib/money";
import { deliveryWindow, SHIPPING_RATES, type ShippingTierKey } from "@/lib/pricing";
import { getCurrentUser } from "@/server/auth/session";
import { CATEGORY_META } from "@/server/db/catalog-data";
import { getBundlesFor, getProductBySlug, getRelated, getReviews, hasReviewed } from "@/server/services/catalog";
import { hasPurchased } from "@/server/services/orders";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = getProductBySlug((await params).slug);
  if (!product) return { title: "Product not found" };
  return {
    title: product.name,
    description: `${product.tagline} ${product.description.slice(0, 120)}`.trim(),
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: { title: product.name, description: product.tagline, images: product.images.slice(0, 1).map((i) => ({ url: i.src, alt: i.alt })) },
  };
}

const windowLabel = (tier: ShippingTierKey) => {
  const w = deliveryWindow(tier);
  const fmt = { weekday: "short", month: "short", day: "numeric" } as const;
  return `${formatDate(w.from, fmt)} to ${formatDate(w.to, fmt)}`;
};

export default async function ProductPage({ params }: Props) {
  const product = getProductBySlug((await params).slug);
  if (!product) notFound();

  const [user, reviews] = [await getCurrentUser(), getReviews(product.id)];
  let eligibility: ReviewEligibility = "signed-out";
  if (user?.role === "admin") eligibility = "staff";
  else if (user) eligibility = hasReviewed(user.id, product.id) ? "already-reviewed" : hasPurchased(user.id, product.id) ? "eligible" : "not-purchased";

  const delivery: DeliveryEstimate[] = (Object.keys(SHIPPING_RATES) as ShippingTierKey[]).map((t) => ({ label: SHIPPING_RATES[t].label, fee: SHIPPING_RATES[t].fee, window: windowLabel(t) }));
  const specs: SpecRow[] = [
    ...Object.entries(product.specs).map(([label, value]) => ({ label, value })),
    ...(product.materials ? [{ label: "Materials", value: product.materials }] : []),
    ...(product.dimensions ? [{ label: "Dimensions", value: product.dimensions }] : []),
    { label: "Weight", value: product.weightGrams >= 1000 ? `${(product.weightGrams / 1000).toFixed(2)} kg` : `${product.weightGrams} g` },
  ];
  const bundles = getBundlesFor(product.id).map(({ complete: _complete, ...b }) => b);
  const related = getRelated(product, 8);
  const category = CATEGORY_META[product.category];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.tagline,
    brand: { "@type": "Brand", name: product.brand },
    image: product.images.map((i) => i.src),
    sku: product.variants[0]?.sku,
    ...(product.ratingCount > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: product.ratingAvg, reviewCount: product.ratingCount } } : {}),
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "PHP",
      lowPrice: (Math.min(...product.variants.map((v) => v.price)) / 100).toFixed(2),
      highPrice: (Math.max(...product.variants.map((v) => v.price)) / 100).toFixed(2),
      offerCount: product.variants.length,
      availability: product.totalStock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div className="shell space-y-section pb-36 pt-6 lg:pb-section lg:pt-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <TrackView productId={product.id} />

      <div className="space-y-6">
        <nav aria-label="Breadcrumb" className="text-sm text-subtle">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="hover:text-fg">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link href={`/products?category=${product.category}`} className="hover:text-fg">
                {category.label}
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="line-clamp-1 text-muted">
              {product.name}
            </li>
          </ol>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] xl:gap-16">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <Gallery images={product.images} name={product.name} />
          </div>
          <BuyBox product={product} delivery={delivery} />
        </div>
      </div>

      <InfoTabs descriptionHtml={product.descriptionHtml} specs={specs} />

      <Bundles bundles={bundles} />

      <Reviews
        productId={product.id}
        slug={product.slug}
        average={product.ratingAvg}
        count={product.ratingCount}
        histogram={reviews.histogram}
        reviews={reviews.list.map((r) => ({ id: r.id, authorName: r.authorName, rating: r.rating, title: r.title, body: r.body, verified: r.verified, createdAt: r.createdAt.getTime() }))}
        eligibility={eligibility}
      />

      {related.length > 0 && (
        <section aria-labelledby="related-title" className="space-y-6">
          <SectionHeading id="related-title" title="You may also like" accent={`More from ${category.label.toLowerCase()} and beyond.`} />
          <ProductRail products={related} label="You may also like" />
        </section>
      )}

      <RecentlyViewed excludeId={product.id} />
    </div>
  );
}
