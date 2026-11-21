import { ArrowRight, BadgePercent, Headphones, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BentoGrid, type BentoItem } from "@/components/kokonut/bento-grid";
import { Hero } from "@/components/store/hero";
import { Lookbook, type LookPiece } from "@/components/store/lookbook";
import { CategoryTabs, type CategoryTab } from "@/components/store/category-tabs";
import { RecentlyViewed } from "@/components/store/recently-viewed";
import { TrendingSlider, type TrendingSlide } from "@/components/store/trending-slider";
import { SectionHeading } from "@/components/ui/bits";
import { buttonVariants } from "@/components/ui/button-variants";
import type { CategoryKey, ProductCardData } from "@/lib/types";
import { CATEGORY_META } from "@/server/db/catalog-data";
import { listProducts } from "@/server/services/catalog";

export const metadata: Metadata = {
  title: { absolute: "Emporium · Tech, home, accessories and clothes" },
  description: "Where every click brings you closer to what you love. Curated gadgets, home pieces, accessories and clothes, shipped across the Philippines.",
};

const TRENDING: TrendingSlide[] = [
  { src: "/images/promo/trend-vision.webp", alt: "Apple Vision Pro. Welcome to the future. From ₱20,000 or ₱1,200 a month for 12 months.", href: "/products/apple-vision-pro", label: "Apple Vision Pro" },
  { src: "/images/promo/trend-cat.webp", alt: "Cat plushie. Fluffy cat! Cute, isn't it? You can get it for only ₱299.", href: "/products/black-cat-plushie", label: "Black Cat Plushie" },
  { src: "/images/promo/trend-watch.webp", alt: "Black watch. Very demure, very manly. You can get it for only ₱399.", href: "/products/noir-minimalist-watch", label: "Noir Minimalist Watch" },
  { src: "/images/promo/trend-jacket.webp", alt: "Blue jacket. New modern jacket. You can get it for only ₱599.", href: "/products/blue-jacket", label: "Blue Jacket" },
];

const BENTO: BentoItem[] = [
  {
    title: "Gadgets",
    blurb: CATEGORY_META.gadgets.blurb,
    meta: "Featured collection",
    href: "/products?category=gadgets",
    image: "/images/products/vision-pro-2.webp",
    imageAlt: "Apple Vision Pro headset seen from the front",
    className: "md:col-span-2 md:row-span-2",
    imageClassName: "object-[center_35%]",
  },
  {
    title: "Clothes",
    blurb: CATEGORY_META.clothes.blurb,
    meta: "New season",
    href: "/products?category=clothes",
    image: "/images/products/blue-jacket-2.webp",
    imageAlt: "Close-up of a navy hoodie with a yellow line-art print",
    className: "md:col-span-2",
    imageClassName: "object-[center_30%]",
  },
  {
    title: "Accessories",
    blurb: "Watches and cases that finish the look.",
    href: "/products?category=accessories",
    image: "/images/products/black-watch-2.webp",
    imageAlt: "Black minimalist watch with a mesh strap",
  },
  {
    title: "Home",
    blurb: "Soft, playful pieces for your space.",
    href: "/products?category=furniture",
    image: "/images/products/cat-plushie-2.webp",
    imageAlt: "Close-up of a black cat plushie with yellow eyes",
  },
  {
    title: "New arrivals",
    blurb: "Fresh drops, sorted newest first.",
    meta: "Just landed",
    href: "/products?sort=newest",
    image: "/images/products/iphone-15-pro-2.webp",
    imageAlt: "iPhone 15 Pro camera array in natural titanium",
    className: "md:col-span-3",
    imageClassName: "object-[center_40%]",
  },
  {
    title: "On sale",
    blurb: "Marked-down favourites while stock lasts.",
    meta: "Deals",
    href: "/products?sale=1",
    image: "/images/products/airpods-2.webp",
    imageAlt: "AirPods resting on a white surface",
  },
];

const LOOK: { id: string; mobile: LookPiece["mobile"]; desktop: LookPiece["desktop"] }[] = [
  { id: "prd_bluejacket", mobile: [6, 22, 46, -4], desktop: [30, 12, 26, -3] },
  { id: "prd_blackwatch", mobile: [56, 18, 36, 5], desktop: [60, 8, 17, 4] },
  { id: "prd_airpods2", mobile: [50, 58, 32, -6], desktop: [80, 30, 15, -5] },
  { id: "prd_ip13case", mobile: [10, 66, 30, 6], desktop: [58, 52, 16, 6] },
  { id: "prd_catplush", mobile: [64, 82, 26, 3], desktop: [36, 62, 18, -6] },
];

const PROMISES = [
  { icon: Truck, title: "Fast, tracked delivery", copy: "Standard 3 to 5 business days, express 1 to 2. Free over ₱2,500." },
  { icon: RotateCcw, title: "30-day returns", copy: "Request a return from your order page. No emails, no phone queues." },
  { icon: ShieldCheck, title: "Secure checkout", copy: "Prices include 12% VAT. Totals are recalculated on our servers, always." },
  { icon: Headphones, title: "Real humans", copy: "Questions about an order? Our support team replies within a day." },
];

export default function HomePage() {
  const all = listProducts({ sort: "featured" });
  const byId = new Map(all.map((p) => [p.id, p]));
  const pieces: LookPiece[] = LOOK.flatMap((l) => {
    const product = byId.get(l.id);
    return product ? [{ product, mobile: l.mobile, desktop: l.desktop }] : [];
  });
  const bestSellers: ProductCardData[] = listProducts({ sort: "best-selling" });
  const tabs: CategoryTab[] = [
    { key: "all", label: "All", blurb: "Everything our customers keep coming back for." },
    ...(Object.keys(CATEGORY_META) as CategoryKey[]).filter((key) => bestSellers.some((p) => p.category === key)).map((key) => ({ key, label: CATEGORY_META[key].label, blurb: CATEGORY_META[key].blurb })),
  ];

  return (
    <>
      <Hero />
      <div className="shell space-y-section pb-section">
        <section id="trending" aria-labelledby="trending-title" className="scroll-mt-28 space-y-6">
          <SectionHeading id="trending-title" eyebrow="This week" title="Trending!" accent="What everyone is adding to their bag." />
          <TrendingSlider slides={TRENDING} />
        </section>

        <section aria-labelledby="collections-title" className="space-y-6">
          <SectionHeading id="collections-title" eyebrow="Collections" title="Shop by mood" accent="Four aisles, zero clutter.">
            <Link href="/products" className="group inline-flex min-h-tap items-center gap-2 text-sm text-muted hover:text-fg">
              Browse everything <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          </SectionHeading>
          <BentoGrid items={BENTO} />
        </section>

        <section aria-labelledby="bestsellers-title" className="space-y-6">
          <SectionHeading id="bestsellers-title" eyebrow="Most loved" title="Best sellers" accent="Ranked by real orders." />
          <CategoryTabs products={bestSellers} tabs={tabs} />
        </section>

        <section aria-labelledby="quality-title" className="grid items-center gap-10 overflow-hidden rounded-xl border border-line bg-surface/50 p-6 md:grid-cols-[1.1fr_1fr] md:p-12">
          <div className="space-y-5">
            <p className="text-2xs uppercase tracking-[0.3em] text-subtle">Members save more</p>
            <h2 id="quality-title" className="text-3xl font-light leading-tight">
              Shop quality. <span className="text-accent">Shop stylish.</span> Shop with ease.
            </h2>
            <p className="max-w-[34rem] text-muted">
              Create a free account and take <strong className="font-medium text-fg">10% off your first order</strong> with code{" "}
              <code className="rounded-xs border border-line px-1.5 py-0.5 text-price">WELCOME10</code>. Buy two of the same item and save 10%, three or more and save 20%.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/register" className={buttonVariants({ size: "lg" })}>
                <BadgePercent className="size-5" aria-hidden /> Create free account
              </Link>
              <Link href="/products?sale=1" className={buttonVariants({ size: "lg", variant: "outline" })}>
                See today&apos;s deals
              </Link>
            </div>
          </div>
          <Image src="/images/brand/illus-promo.webp" alt="Illustration of a shopper announcing a sale through a megaphone from a phone screen" width={500} height={360} className="mx-auto h-auto w-full max-w-[28rem]" />
        </section>


        {pieces.length >= 3 && <Lookbook title="The weekend carry" pieces={pieces} />}

        <section aria-labelledby="welcome-title" className="grid items-center gap-10 md:grid-cols-[1fr_1.1fr]">
          <Image src="/images/brand/illus-team.webp" alt="Illustration of three confident people in sunglasses with arms crossed" width={520} height={300} className="order-last mx-auto h-auto w-full max-w-[30rem] md:order-first" />
          <div className="space-y-5">
            <p className="text-2xs uppercase tracking-[0.3em] text-subtle">About us</p>
            <h2 id="welcome-title" className="text-3xl font-light leading-tight">
              Welcome to Emporium, your one-stop shop for <span className="text-accent">everything you love.</span>
            </h2>
            <p className="max-w-[36rem] text-muted">
              We are a small team that picks every product by hand, writes honest descriptions and ships from Metro Manila. If it isn&apos;t something we would buy ourselves, it doesn&apos;t make the cut.
            </p>
            <Link href="/support" className={buttonVariants({ variant: "outline" })}>
              Talk to our team
            </Link>
          </div>
        </section>

        <RecentlyViewed />

        <section aria-label="Our promises" className="grid gap-4 border-t border-line pt-section sm:grid-cols-2 lg:grid-cols-4">
          {PROMISES.map(({ icon: Icon, title, copy }) => (
            <div key={title} className="space-y-2 rounded-lg p-2">
              <Icon className="size-6 text-price" aria-hidden />
              <h3 className="text-lg">{title}</h3>
              <p className="text-sm text-muted">{copy}</p>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
