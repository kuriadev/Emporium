import "server-only";
import { and, count, eq, inArray } from "drizzle-orm";
import type { PricingPromo } from "@/lib/pricing";
import { getDb, schema } from "../db";

export interface PromoCheck {
  promos: PricingPromo[];
  rejected: { code: string; reason: string }[];
}

/** Applies eligibility rules (active window, global/per-user caps). Spend and stacking rules run in the pricing engine. */
export function resolvePromos(codes: readonly string[], userId: string | null, now = new Date()): PromoCheck {
  const unique = [...new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean))].slice(0, 2);
  if (!unique.length) return { promos: [], rejected: [] };
  const db = getDb();
  const rows = db.select().from(schema.promoCodes).where(inArray(schema.promoCodes.code, unique)).all();
  const promos: PricingPromo[] = [];
  const rejected: PromoCheck["rejected"] = [];

  for (const code of unique) {
    const p = rows.find((r) => r.code === code);
    const reason = !p
      ? "This code doesn't exist"
      : !p.active
        ? "This code is no longer active"
        : p.startsAt && p.startsAt > now
          ? "This code isn't active yet"
          : p.endsAt && p.endsAt < now
            ? "This code has expired"
            : p.usageLimit !== null && p.usedCount >= p.usageLimit
              ? "This code has been fully redeemed"
              : null;
    if (reason || !p) {
      rejected.push({ code, reason: reason ?? "Invalid code" });
      continue;
    }
    if (p.perUserLimit !== null) {
      if (!userId) {
        rejected.push({ code, reason: "Sign in to use this code" });
        continue;
      }
      const used = db
        .select({ n: count() })
        .from(schema.promoRedemptions)
        .where(and(eq(schema.promoRedemptions.promoId, p.id), eq(schema.promoRedemptions.userId, userId)))
        .get();
      if ((used?.n ?? 0) >= p.perUserLimit) {
        rejected.push({ code, reason: "You've already used this code" });
        continue;
      }
    }
    promos.push({ code: p.code, type: p.type, value: p.value, minSubtotal: p.minSubtotal, stackable: p.stackable });
  }
  return { promos, rejected };
}
