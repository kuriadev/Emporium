"use client";

import { toast } from "sonner";
import { create } from "zustand";
import { computeTotals } from "@/lib/pricing";
import type { ActionResult } from "@/lib/types";
import {
  addBundleAction,
  addToCartAction,
  getCartAction,
  getWishlistAction,
  toggleWishlistAction,
  updateCartAction,
  type CartQuote,
} from "@/server/actions/shop";

type UiPanel = "cart" | "search" | "compare" | "command" | null;

interface CartState {
  cart: CartQuote | null;
  wishlist: string[];
  panel: UiPanel;
  busyVariant: string | null;
  lastAddedAt: number;
  setPanel: (p: UiPanel) => void;
  hydrate: () => Promise<void>;
  add: (variantId: string, quantity?: number, opts?: { open?: boolean }) => Promise<boolean>;
  addBundle: (variantIds: string[]) => Promise<boolean>;
  setQuantity: (variantId: string, quantity: number) => Promise<void>;
  remove: (variantId: string) => Promise<void>;
  toggleWishlist: (productId: string) => Promise<void>;
  applyServer: (cart: CartQuote) => void;
}

function optimistic(cart: CartQuote, variantId: string, quantity: number): CartQuote {
  const lines = cart.lines
    .map((l) => (l.variantId === variantId ? { ...l, quantity, lineTotal: l.unitPrice * quantity } : l))
    .filter((l) => l.quantity > 0);
  const totals = computeTotals({
    lines: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, unitPrice: l.unitPrice, quantity: l.quantity, tierPricing: l.tierPricing })),
  });
  return { ...cart, lines, itemCount: lines.reduce((a, l) => a + l.quantity, 0), totals: { ...totals, bundleDiscount: cart.totals.bundleDiscount } };
}

function report<T>(res: ActionResult<T>): res is { ok: true; data: T; message?: string } {
  if (!res.ok) toast.error(res.error, res.retryAfter ? { description: `Retry in ${res.retryAfter}s` } : undefined);
  return res.ok;
}

export const useCart = create<CartState>()((set, get) => ({
  cart: null,
  wishlist: [],
  panel: null,
  busyVariant: null,
  lastAddedAt: 0,
  setPanel: (panel) => set({ panel }),
  applyServer: (cart) => set({ cart }),

  hydrate: async () => {
    const [res, wishlist] = await Promise.all([getCartAction(), getWishlistAction()]);
    set({ wishlist, ...(res.ok ? { cart: res.data } : {}) });
  },

  add: async (variantId, quantity = 1, opts = { open: true }) => {
    set({ busyVariant: variantId });
    const res = await addToCartAction({ variantId, quantity });
    set({ busyVariant: null });
    if (!report(res)) return false;
    set({ cart: res.data, lastAddedAt: Date.now(), ...(opts.open ? { panel: "cart" as const } : {}) });
    toast.success(res.message ?? "Added to bag");
    return true;
  },

  addBundle: async (variantIds) => {
    const res = await addBundleAction(variantIds);
    if (!report(res)) return false;
    set({ cart: res.data, panel: "cart", lastAddedAt: Date.now() });
    toast.success(res.message ?? "Bundle added");
    return true;
  },

  setQuantity: async (variantId, quantity) => {
    const before = get().cart;
    if (before) set({ cart: optimistic(before, variantId, quantity) });
    const res = await updateCartAction({ variantId, quantity });
    if (!res.ok) {
      set({ cart: before });
      toast.error(res.error, { description: "Your bag was restored." });
      return;
    }
    set({ cart: res.data });
  },

  remove: async (variantId) => {
    const before = get().cart;
    const line = before?.lines.find((l) => l.variantId === variantId);
    if (!before || !line) return;
    await get().setQuantity(variantId, 0);
    toast(`${line.name} removed`, {
      description: line.variantLabel,
      action: { label: "Undo", onClick: () => void get().setQuantity(variantId, line.quantity) },
      duration: 6000,
    });
  },

  toggleWishlist: async (productId) => {
    const before = get().wishlist;
    const on = !before.includes(productId);
    set({ wishlist: on ? [...before, productId] : before.filter((x) => x !== productId) });
    const res = await toggleWishlistAction(productId, on);
    if (!res.ok) {
      set({ wishlist: before });
      toast.error(res.error);
      return;
    }
    set({ wishlist: res.data });
    if (on) toast.success("Saved to wishlist");
    else toast("Removed from wishlist", { action: { label: "Undo", onClick: () => void get().toggleWishlist(productId) } });
  },
}));
