import { Compass, Search } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";

/** Zero-dead-end 404: always offers search, the catalog and home. */
export function NotFoundView({ title = "This page has moved or never existed", links = "store" }: { title?: string; links?: "store" | "admin" }) {
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-[36rem] flex-col items-center justify-center px-gutter py-16 text-center">
      <Compass className="size-10 text-accent" aria-hidden />
      <p className="mt-4 text-2xs uppercase tracking-[0.3em] text-subtle">Error 404</p>
      <h1 className="mt-3 text-3xl font-light sm:text-4xl">{title}</h1>
      {links === "store" ? (
        <>
          <p className="mt-3 text-muted">Check the address, or search the shop. Everything in stock is one tap away.</p>
          <form role="search" action="/products" className="mt-8 flex w-full max-w-[26rem] gap-2">
            <label htmlFor="nf-q" className="sr-only">
              Search products
            </label>
            <input id="nf-q" name="q" type="search" maxLength={80} placeholder="Try “headphones” or “linen”" className="min-h-tap w-full rounded-pill border border-line bg-surface/70 px-4 text-sm outline-none transition focus:border-accent" />
            <button type="submit" className={buttonVariants({ size: "md" })} aria-label="Search">
              <Search className="size-4" aria-hidden />
            </button>
          </form>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/products" className={buttonVariants({ variant: "outline" })}>
              Browse all products
            </Link>
            <Link href="/" className={buttonVariants({ variant: "ghost" })}>
              Home
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 text-muted">It may have been deleted, or the link is out of date.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/admin" className={buttonVariants()}>
              Dashboard
            </Link>
            <Link href="/admin/orders" className={buttonVariants({ variant: "outline" })}>
              Orders
            </Link>
            <Link href="/admin/products" className={buttonVariants({ variant: "outline" })}>
              Products
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
