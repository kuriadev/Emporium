"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { isCurrency, type CurrencyCode } from "@/lib/money";

const MAX_RECENT = 8;
export const MAX_COMPARE = 4;

interface PrefsState {
  currency: CurrencyCode;
  recentlyViewed: string[];
  compare: string[];
  setCurrency: (c: CurrencyCode) => void;
  trackView: (productId: string) => void;
  toggleCompare: (productId: string) => boolean;
  clearCompare: () => void;
}

const ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Non-sensitive UI preferences only. Nothing auth-related is ever stored client-side;
 * persisted values are re-validated on rehydrate because localStorage is user-controlled.
 */
export const usePrefs = create<PrefsState>()(
  persist(
    (set, get) => ({
      currency: "PHP",
      recentlyViewed: [],
      compare: [],
      setCurrency: (currency) => set({ currency }),
      trackView: (id) => set((s) => ({ recentlyViewed: [id, ...s.recentlyViewed.filter((x) => x !== id)].slice(0, MAX_RECENT) })),
      toggleCompare: (id) => {
        const { compare } = get();
        if (compare.includes(id)) {
          set({ compare: compare.filter((x) => x !== id) });
          return true;
        }
        if (compare.length >= MAX_COMPARE) return false;
        set({ compare: [...compare, id] });
        return true;
      },
      clearCompare: () => set({ compare: [] }),
    }),
    {
      name: "emporium-prefs",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ currency, recentlyViewed, compare }) => ({ currency, recentlyViewed, compare }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PrefsState>;
        const ids = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && ID.test(x)).slice(0, max) : []);
        return {
          ...current,
          currency: isCurrency(p.currency) ? p.currency : "PHP",
          recentlyViewed: ids(p.recentlyViewed, MAX_RECENT),
          compare: ids(p.compare, MAX_COMPARE),
        };
      },
    },
  ),
);
