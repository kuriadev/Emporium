"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ShippingTierKey } from "@/lib/pricing";

interface CheckoutOptions {
  promoCodes: string[];
  shippingTier: ShippingTierKey;
  giftWrap: boolean;
  setPromoCodes: (codes: string[]) => void;
  setShippingTier: (tier: ShippingTierKey) => void;
  setGiftWrap: (on: boolean) => void;
  reset: () => void;
}

const CODE = /^[A-Z0-9]{3,20}$/;

/** Cart → checkout hand-off for non-sensitive options (tab-scoped). The server re-validates everything. */
export const useCheckoutOptions = create<CheckoutOptions>()(
  persist(
    (set) => ({
      promoCodes: [],
      shippingTier: "standard",
      giftWrap: false,
      setPromoCodes: (promoCodes) => set({ promoCodes }),
      setShippingTier: (shippingTier) => set({ shippingTier }),
      setGiftWrap: (giftWrap) => set({ giftWrap }),
      reset: () => set({ promoCodes: [], shippingTier: "standard", giftWrap: false }),
    }),
    {
      name: "emporium-checkout",
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
      partialize: ({ promoCodes, shippingTier, giftWrap }) => ({ promoCodes, shippingTier, giftWrap }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<CheckoutOptions>;
        return {
          ...current,
          promoCodes: Array.isArray(p.promoCodes) ? p.promoCodes.filter((c): c is string => typeof c === "string" && CODE.test(c)).slice(0, 2) : [],
          shippingTier: p.shippingTier === "express" ? "express" : "standard",
          giftWrap: p.giftWrap === true,
        };
      },
    },
  ),
);
