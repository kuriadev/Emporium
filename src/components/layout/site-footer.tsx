import Link from "next/link";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="relative mt-section overflow-hidden pb-28 pt-16 lg:pb-12">
      <div aria-hidden className="pointer-events-none absolute inset-x-[-20%] top-0 h-[30rem] rounded-[50%] border-t border-white/40 shadow-[0_-1rem_6rem_-1rem_oklch(1_0_0/0.35)]" />
      <div className="shell relative">
        <div className="grid gap-10 border-t border-line pt-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-2xs uppercase tracking-[0.3em] text-subtle">Shop</p>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              <li><Link className="hover:text-fg" href="/products?category=gadgets">Gadgets</Link></li>
              <li><Link className="hover:text-fg" href="/products?category=furniture">Furniture</Link></li>
              <li><Link className="hover:text-fg" href="/products?category=accessories">Accessories</Link></li>
              <li><Link className="hover:text-fg" href="/products?category=clothes">Clothes</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-2xs uppercase tracking-[0.3em] text-subtle">Help</p>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              <li><Link className="hover:text-fg" href="/support">Contact support</Link></li>
              <li><Link className="hover:text-fg" href="/support#shipping">Shipping &amp; delivery</Link></li>
              <li><Link className="hover:text-fg" href="/support#returns">30-day returns</Link></li>
              <li><Link className="hover:text-fg" href="/account">Track an order</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-2xs uppercase tracking-[0.3em] text-subtle">Why Emporium</p>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              <li>Free shipping over ₱2,500</li>
              <li>Secure checkout · VAT included</li>
              <li>Verified buyer reviews</li>
            </ul>
          </div>
          <div>
            <p className="text-2xs uppercase tracking-[0.3em] text-subtle">Follow</p>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              <li>Twitter</li>
              <li>Facebook</li>
              <li>Instagram</li>
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-line pt-6 text-xs text-subtle sm:flex-row">
          <span>© {new Date().getFullYear()} Emporium. Demo storefront.</span>
          <Logo />
          <span>Philippines</span>
        </div>
      </div>
    </footer>
  );
}
