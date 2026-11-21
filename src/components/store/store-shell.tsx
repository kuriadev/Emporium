"use client";

import { useEffect } from "react";
import type { ProductCardData } from "@/lib/types";
import { useCart } from "@/stores/cart";
import { CartDrawer } from "./cart-drawer";
import { CommandPalette, type PaletteItem } from "./command-palette";
import { CompareSheet, CompareTray } from "./compare";
import { QuickView } from "./quick-view";
import { SearchOverlay } from "./search-overlay";

const STATIC_ITEMS: PaletteItem[] = [
  { id: "home", label: "Home", href: "/", group: "Go to" },
  { id: "store", label: "All products", href: "/products", group: "Go to" },
  { id: "cart", label: "Bag", href: "/cart", group: "Go to" },
  { id: "checkout", label: "Checkout", href: "/checkout", group: "Go to" },
  { id: "wishlist", label: "Wishlist", href: "/wishlist", group: "Go to" },
  { id: "account", label: "My account & orders", href: "/account", group: "Go to" },
  { id: "support", label: "Support", href: "/support", group: "Go to" },
  { id: "c-gadgets", label: "Gadgets", href: "/products?category=gadgets", group: "Categories" },
  { id: "c-furniture", label: "Furniture", href: "/products?category=furniture", group: "Categories" },
  { id: "c-accessories", label: "Accessories", href: "/products?category=accessories", group: "Categories" },
  { id: "c-clothes", label: "Clothes", href: "/products?category=clothes", group: "Categories" },
];

export function StoreShell({ bestsellers, orders }: { bestsellers: ProductCardData[]; orders: { id: string; number: string; status: string }[] }) {
  const hydrate = useCart((s) => s.hydrate);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const items = [...STATIC_ITEMS, ...orders.map((o) => ({ id: o.id, label: `Order ${o.number}`, hint: o.status, href: `/orders/${o.id}`, group: "Your orders" }))];

  return (
    <>
      <CartDrawer />
      <SearchOverlay bestsellers={bestsellers.slice(0, 4)} />
      <CommandPalette items={items} />
      <QuickView />
      <CompareTray />
      <CompareSheet />
    </>
  );
}
