"use client";

import { Heart, Home, Search, ShoppingBag, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useCart } from "@/stores/cart";
import { CartCount } from "./site-header";

/** Thumb-zone dock for phones and small tablets. Hidden from lg up where the header has room. */
export function MobileDock({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const setPanel = useCart((s) => s.setPanel);
  const item = "relative flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 text-2xs tracking-wide";
  const active = (p: string) => (p === "/" ? pathname === "/" : pathname.startsWith(p));
  return (
    <nav aria-label="Mobile dock" className="glass fixed inset-x-3 bottom-3 z-40 flex rounded-pill px-2 pb-[env(safe-area-inset-bottom)] lg:hidden">
      <Link href="/" className={cn(item, active("/") ? "text-fg" : "text-muted")} aria-current={active("/") ? "page" : undefined}>
        <Home className="size-5" aria-hidden /> Home
      </Link>
      <button type="button" onClick={() => setPanel("search")} className={cn(item, "text-muted")}>
        <Search className="size-5" aria-hidden /> Search
      </button>
      <Link href="/wishlist" className={cn(item, active("/wishlist") ? "text-fg" : "text-muted")}>
        <Heart className="size-5" aria-hidden /> Wishlist
      </Link>
      <button type="button" onClick={() => setPanel("cart")} className={cn(item, "text-muted")}>
        <span className="relative">
          <ShoppingBag className="size-5" aria-hidden />
          <CartCount className="-right-2.5 -top-2" />
        </span>
        Bag
      </button>
      <Link href={signedIn ? "/account" : "/login"} className={cn(item, active("/account") ? "text-fg" : "text-muted")}>
        <User className="size-5" aria-hidden /> {signedIn ? "Account" : "Sign in"}
      </Link>
    </nav>
  );
}
