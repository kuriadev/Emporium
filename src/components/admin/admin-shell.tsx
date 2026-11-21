"use client";

import { motion } from "framer-motion";
import { LayoutDashboard, LogOut, Menu, Package, Receipt, ScrollText, Search, Store, TicketPercent, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { Logo } from "@/components/layout/logo";
import { CommandPalette, type PaletteItem } from "@/components/store/command-palette";
import { Badge } from "@/components/ui/bits";
import { Sheet } from "@/components/ui/overlay";
import { cn } from "@/lib/utils";
import { adminCommandSearchAction } from "@/server/actions/admin";
import { logoutAction } from "@/server/actions/auth";
import type { AdminRole } from "@/server/db/schema";
import { ADMIN_ROLE_LABEL, can, type Permission } from "@/server/auth/permissions";
import { useCart } from "@/stores/cart";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: Permission;
  count?: "orders" | "products";
}

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard:view" },
  { href: "/admin/orders", label: "Orders", icon: Receipt, permission: "orders:view", count: "orders" },
  { href: "/admin/products", label: "Products", icon: Package, permission: "catalog:write", count: "products" },
  { href: "/admin/customers", label: "Customers", icon: Users, permission: "customers:view" },
  { href: "/admin/promotions", label: "Promotions", icon: TicketPercent, permission: "promotions:write" },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText, permission: "audit:view" },
];

export interface AdminShellUser {
  name: string;
  email: string;
  adminRole: AdminRole;
}

const isActive = (pathname: string, href: string) => (href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`));

function NavLinks({ items, pathname, counts, onNavigate, layoutId }: { items: NavItem[]; pathname: string; counts: Record<string, number>; onNavigate?: () => void; layoutId: string }) {
  return (
    <ul className="isolate space-y-1">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const n = item.count ? counts[item.count] : 0;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn("relative flex min-h-tap items-center gap-3 rounded-md px-3 text-sm transition-colors", active ? "text-fg" : "text-muted hover:bg-white/5 hover:text-fg")}
            >
              {active && <motion.span layoutId={layoutId} className="absolute inset-0 -z-10 rounded-md border border-line-strong bg-white/[0.07]" transition={{ type: "spring", stiffness: 520, damping: 38 }} />}
              <item.icon className="size-4 shrink-0" aria-hidden />
              <span className="flex-1">{item.label}</span>
              {n ? (
                <span className="rounded-pill bg-accent/15 px-2 py-0.5 text-2xs tabular-nums text-accent">
                  {n}
                  <span className="sr-only"> need attention</span>
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SignOut({ className }: { className?: string }) {
  return (
    <form action={logoutAction}>
      <button type="submit" className={cn("flex min-h-tap w-full items-center gap-3 rounded-md px-3 text-sm text-muted transition-colors hover:bg-danger/10 hover:text-danger", className)}>
        <LogOut className="size-4" aria-hidden /> Sign out
      </button>
    </form>
  );
}

/**
 * Staff chrome: role-filtered navigation (sidebar on desktop, bottom bar + sheet on mobile) and the
 * admin ⌘K palette. Hiding a link is only a convenience; every page and action re-checks permissions.
 */
export function AdminShell({ user, counts, children }: { user: AdminShellUser; counts: { orders: number; products: number }; children: React.ReactNode }) {
  const pathname = usePathname();
  const setPanel = useCart((s) => s.setPanel);
  const [menuOpen, setMenuOpen] = useState(false);
  const items = NAV.filter((n) => can(user.adminRole, n.permission));
  const primary = items.slice(0, 4);
  const roleLabel = ADMIN_ROLE_LABEL[user.adminRole];

  const paletteItems: PaletteItem[] = [
    ...items.map((n) => ({ id: n.href, label: n.label, href: n.href, group: "Go to" })),
    ...(can(user.adminRole, "catalog:write")
      ? [
          { id: "new-product", label: "Create a product", href: "/admin/products/new", group: "Actions" },
          { id: "restock", label: "Variants that need restocking", href: "/admin/products?stock=low", group: "Actions" },
        ]
      : []),
    ...(can(user.adminRole, "orders:view")
      ? [
          { id: "to-pack", label: "Orders waiting to be packed", href: "/admin/orders?status=paid", group: "Actions" },
          { id: "returns", label: "Return requests", href: "/admin/orders?status=returns", group: "Actions" },
        ]
      : []),
    ...(can(user.adminRole, "promotions:write") ? [{ id: "new-promo", label: "Create a promo code", href: "/admin/promotions?new=1", group: "Actions" }] : []),
    { id: "store", label: "Open the storefront", href: "/", group: "Go to" },
  ];

  const search = useCallback(async (q: string): Promise<PaletteItem[]> => {
    const { orders, skus } = await adminCommandSearchAction(q);
    return [
      ...orders.map((o) => ({ id: o.id, label: `Order ${o.number}`, hint: o.status, href: `/admin/orders/${o.id}`, group: "Orders" })),
      ...skus.map((v) => ({ id: v.sku, label: v.name, hint: v.sku, href: `/admin/products/${v.productId}`, group: "Products & SKUs" })),
    ];
  }, []);

  const searchButton = (
    <button
      type="button"
      onClick={() => setPanel("command")}
      aria-keyshortcuts="Control+K Meta+K"
      className="flex min-h-tap w-full max-w-[28rem] items-center gap-3 rounded-pill border border-line bg-surface/70 px-4 text-left text-sm text-subtle transition hover:border-line-strong hover:text-muted"
    >
      <Search className="size-4 shrink-0" aria-hidden />
      <span className="flex-1 truncate">Search orders, SKUs, pages…</span>
      <kbd className="hidden rounded-xs border border-line px-1.5 py-0.5 font-sans text-2xs text-subtle sm:inline">Ctrl K</kbd>
    </button>
  );

  return (
    <div className="min-h-dvh lg:pl-[16.5rem]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[16.5rem] flex-col border-r border-line bg-surface/85 backdrop-blur-xl lg:flex">
        <div className="flex h-[4.5rem] items-center gap-3 px-5">
          <Logo href="/admin" label="Emporium admin dashboard" />
          <Badge tone="accent">Staff</Badge>
        </div>
        <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3 py-4">
          <NavLinks items={items} pathname={pathname} counts={counts} layoutId="admin-nav-desktop" />
        </nav>
        <div className="space-y-1 border-t border-line p-3">
          <div className="px-3 py-2">
            <p className="truncate text-sm">{user.name}</p>
            <p className="truncate text-xs text-subtle">
              {roleLabel} · {user.email}
            </p>
          </div>
          <Link href="/" className="flex min-h-tap items-center gap-3 rounded-md px-3 text-sm text-muted transition-colors hover:bg-white/5 hover:text-fg">
            <Store className="size-4" aria-hidden /> View storefront
          </Link>
          <SignOut />
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-xl">
        <div className="flex h-[4rem] items-center gap-3 px-gutter">
          <div className="flex items-center gap-2 lg:hidden">
            <Logo href="/admin" label="Emporium admin dashboard" className="[&_img]:h-[2.25rem]" />
            <Badge tone="accent" className="hidden xs:inline-flex">
              Staff
            </Badge>
          </div>
          <div className="flex flex-1 justify-end lg:justify-start">{searchButton}</div>
          <Badge className="hidden xl:inline-flex">{roleLabel}</Badge>
        </div>
      </header>

      <main id="main" className="px-gutter pb-[7rem] pt-6 lg:pb-16 lg:pt-8">
        {children}
      </main>

      <nav aria-label="Admin quick links" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <ul className="mx-auto grid max-w-[40rem]" style={{ gridTemplateColumns: `repeat(${primary.length + 1}, minmax(0, 1fr))` }}>
          {primary.map((item) => {
            const active = isActive(pathname, item.href);
            const n = item.count ? counts[item.count] : 0;
            return (
              <li key={item.href}>
                <Link href={item.href} aria-current={active ? "page" : undefined} className={cn("relative flex min-h-[3.75rem] flex-col items-center justify-center gap-1 text-2xs", active ? "text-fg" : "text-subtle")}>
                  <span className="relative">
                    <item.icon className="size-5" aria-hidden />
                    {n ? <span aria-hidden className="absolute -right-2 -top-1 size-2 rounded-full bg-accent" /> : null}
                  </span>
                  {item.label}
                  {active && <motion.span layoutId="admin-dock-pill" className="absolute inset-x-4 top-0 h-[0.125rem] rounded-pill bg-accent" />}
                </Link>
              </li>
            );
          })}
          <li>
            <button type="button" onClick={() => setMenuOpen(true)} aria-haspopup="dialog" className="flex min-h-[3.75rem] w-full flex-col items-center justify-center gap-1 text-2xs text-subtle">
              <Menu className="size-5" aria-hidden />
              More
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen} title="Admin menu" description={`${user.name} · ${roleLabel}`} side="bottom">
        <nav aria-label="Admin" className="mt-4">
          <NavLinks items={items} pathname={pathname} counts={counts} onNavigate={() => setMenuOpen(false)} layoutId="admin-nav-sheet" />
        </nav>
        <div className="mt-4 space-y-1 border-t border-line pt-4">
          <Link href="/" onClick={() => setMenuOpen(false)} className="flex min-h-tap items-center gap-3 rounded-md px-3 text-sm text-muted hover:bg-white/5 hover:text-fg">
            <Store className="size-4" aria-hidden /> View storefront
          </Link>
          <SignOut />
        </div>
      </Sheet>

      <CommandPalette items={paletteItems} extraSearch={search} placeholder="Search order numbers, SKUs or admin pages…" />
    </div>
  );
}
