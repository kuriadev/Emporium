"use client";

import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { Command, Heart, Search, ShoppingBag, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CURRENCIES, type CurrencyCode } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useCart } from "@/stores/cart";
import { usePrefs } from "@/stores/prefs";
import { Logo } from "./logo";

export const NAV = [
  { href: "/products", label: "Store", category: null },
  { href: "/products?category=gadgets", label: "Gadgets", category: "gadgets" },
  { href: "/products?category=furniture", label: "Furniture", category: "furniture" },
  { href: "/products?category=accessories", label: "Accessories", category: "accessories" },
  { href: "/products?category=clothes", label: "Clothes", category: "clothes" },
  { href: "/support", label: "Support", category: null },
] as const;

export function CartCount({ className }: { className?: string }) {
  const count = useCart((s) => s.cart?.itemCount ?? 0);
  const lastAddedAt = useCart((s) => s.lastAddedAt);
  if (!count) return null;
  return (
    <motion.span
      key={lastAddedAt}
      initial={{ scale: 1.6 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 600, damping: 14 }}
      className={cn("absolute -right-0.5 -top-0.5 grid min-w-[1.125rem] place-items-center rounded-pill bg-price px-1 text-2xs font-medium text-bg", className)}
    >
      {count}
    </motion.span>
  );
}

export function SiteHeader({ user }: { user: { name: string } | null }) {
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const params = useSearchParams();
  const setPanel = useCart((s) => s.setPanel);
  const currency = usePrefs((s) => s.currency);
  const setCurrency = usePrefs((s) => s.setCurrency);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setScrolled(y > 24);
    if (y > prev && y > 160) setHidden(true);
    else if (y < prev) setHidden(false);
  });

  const activeCategory = params.get("category");

  return (
    <motion.header
      animate={{ y: hidden ? "-110%" : "0%" }}
      transition={{ type: "spring", stiffness: 420, damping: 40 }}
      className={cn("fixed inset-x-0 top-0 z-50 transition-[background-color,border-color] duration-300", scrolled ? "border-b border-line bg-bg/75 backdrop-blur-xl" : "border-b border-transparent")}
    >
      <div className="shell flex h-[4.5rem] items-center gap-4">
        <Logo />
        <nav aria-label="Primary" className="mx-auto hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => {
              const active = item.category ? pathname === "/products" && activeCategory === item.category : item.href === "/products" ? pathname === "/products" && !activeCategory : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link href={item.href} className={cn("relative inline-flex min-h-tap items-center rounded-pill px-4 text-sm tracking-wide transition-colors", active ? "text-fg" : "text-muted hover:text-fg")}>
                    {active && <motion.span layoutId="nav-pill" className="absolute inset-0 -z-10 rounded-pill border border-line-strong bg-white/5" transition={{ type: "spring", stiffness: 500, damping: 35 }} />}
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          <label className="sr-only" htmlFor="currency">
            Display currency
          </label>
          <select
            id="currency"
            value={mounted ? currency : "PHP"}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            className="hidden min-h-tap cursor-pointer rounded-pill bg-transparent px-2 text-xs text-muted outline-none hover:text-fg sm:block"
          >
            {Object.keys(CURRENCIES).map((c) => (
              <option key={c} value={c} className="bg-surface">
                {c}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setPanel("command")} className="hidden min-h-tap items-center gap-2 rounded-pill border border-line px-3 text-xs text-muted transition hover:border-line-strong hover:text-fg xl:inline-flex" aria-label="Open command palette (Control K)">
            <Command className="size-3.5" /> K
          </button>
          <IconButton label="Search" onClick={() => setPanel("search")}>
            <Search className="size-5" />
          </IconButton>
          <IconButton label="Wishlist" href="/wishlist" className="hidden sm:grid">
            <Heart className="size-5" />
          </IconButton>
          <IconButton label="Shopping bag" onClick={() => setPanel("cart")}>
            <ShoppingBag className="size-5" />
            <CartCount />
          </IconButton>
          <IconButton label={user ? `Account (${user.name})` : "Sign in"} href={user ? "/account" : `/login?next=${encodeURIComponent(pathname)}`} className="hidden sm:grid">
            <User className="size-5" />
          </IconButton>
        </div>
      </div>
      <nav aria-label="Categories" className="shell -mt-1 pb-2 lg:hidden">
        <ul className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
          {NAV.map((item) => (
            <li key={item.href} className="shrink-0">
              <Link href={item.href} className={cn("inline-flex min-h-[2.25rem] items-center rounded-pill border px-3 text-xs", item.category && activeCategory === item.category ? "border-fg text-fg" : "border-line text-muted")}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </motion.header>
  );
}

function IconButton({ label, children, onClick, href, className }: { label: string; children: React.ReactNode; onClick?: () => void; href?: string; className?: string }) {
  const cls = cn("relative grid size-tap place-items-center rounded-full text-muted transition hover:bg-white/5 hover:text-fg active:scale-90", className);
  return href ? (
    <Link href={href} aria-label={label} className={cls}>
      {children}
    </Link>
  ) : (
    <button type="button" aria-label={label} onClick={onClick} className={cls}>
      {children}
    </button>
  );
}
