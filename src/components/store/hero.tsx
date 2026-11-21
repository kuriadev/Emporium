import { ArrowRight, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { SplitReveal } from "@/components/motion/split-reveal";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { HeroSearch } from "./hero-search";

const TRUST = [
  { icon: Truck, label: "Free shipping over ₱2,500" },
  { icon: RotateCcw, label: "30-day easy returns" },
  { icon: ShieldCheck, label: "Secure checkout · VAT included" },
];

/** Hero block in the shadcnblocks layout: eyebrow, display title, 3-second value prop, two CTAs, trust row. */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      <Image src="/images/brand/hero-iphone.webp" alt="" fill priority sizes="100vw" className="-z-10 object-cover object-[60%_center] opacity-70" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_20%_40%,oklch(0_0_0/0.85),transparent),linear-gradient(to_top,var(--color-bg),transparent_45%)]" />
      <div className="shell flex min-h-[min(52rem,92dvh)] flex-col justify-center gap-8 py-16">
        <p className="inline-flex w-fit items-center gap-2 rounded-pill border border-line-strong bg-black/40 px-4 py-1.5 text-xs tracking-[0.2em] text-muted backdrop-blur">
          <span className="size-1.5 rounded-full bg-price" aria-hidden /> NEW · iPhone 15 Pro in Natural Titanium
        </p>
        <div className="max-w-[48rem]">
          <SplitReveal as="h1" text="EMPORIUM" className="text-gradient text-display font-light leading-[0.9] tracking-[0.08em]" />
          <p id="hero-title" className="mt-6 max-w-[36rem] text-xl font-light text-fg/90">
            Where every click brings you closer to what you love. <span className="text-accent">Tech, home, accessories and clothes</span>, curated and shipped across the Philippines.
          </p>
        </div>
        <HeroSearch />
        <div className="flex flex-wrap gap-3">
          <Link href="/products" className={cn(buttonVariants({ size: "lg" }), "group")}>
            Shop the collection <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" aria-hidden />
          </Link>
          <Link href="#trending" className={buttonVariants({ size: "lg", variant: "outline" })}>
            See what&apos;s trending
          </Link>
        </div>
        <ul className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted">
          {TRUST.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2">
              <Icon className="size-4 text-price" aria-hidden /> {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
