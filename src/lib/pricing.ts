export const VAT_RATE = 0.12;
export const FREE_SHIPPING_THRESHOLD = 2_500_00;
export const GIFT_WRAP_FEE = 75_00;
export const SHIPPING_RATES = {
  standard: { fee: 120_00, minDays: 3, maxDays: 5, label: "Standard" },
  express: { fee: 250_00, minDays: 1, maxDays: 2, label: "Express" },
} as const;
export type ShippingTierKey = keyof typeof SHIPPING_RATES;

export const VOLUME_TIERS = [
  { minQty: 3, pct: 20 },
  { minQty: 2, pct: 10 },
] as const;

export const MAX_PROMO_CODES = 2;

export interface PricingLine {
  productId: string;
  variantId: string;
  unitPrice: number;
  quantity: number;
  tierPricing: boolean;
}

export interface BundleRule {
  id: string;
  productIds: readonly string[];
  pct: number;
}

export interface PricingPromo {
  code: string;
  type: "percent" | "fixed" | "free_shipping";
  value: number;
  minSubtotal: number;
  stackable: boolean;
}

export interface PricingInput {
  lines: readonly PricingLine[];
  bundles?: readonly BundleRule[];
  promos?: readonly PricingPromo[];
  shippingTier?: ShippingTierKey;
  giftWrap?: boolean;
}

export interface PromoOutcome {
  code: string;
  applied: boolean;
  amount: number;
  reason?: string;
}

export interface PricingResult {
  subtotal: number;
  tierDiscount: number;
  bundleDiscount: number;
  promoDiscount: number;
  merchandiseTotal: number;
  shippingFee: number;
  freeShippingApplied: boolean;
  freeShippingRemaining: number;
  giftWrapFee: number;
  taxIncluded: number;
  total: number;
  promos: PromoOutcome[];
  appliedBundles: string[];
}

const pctOf = (amount: number, pct: number) => Math.floor((amount * pct) / 100);

export function volumeTierPct(quantity: number): number {
  return VOLUME_TIERS.find((t) => quantity >= t.minQty)?.pct ?? 0;
}

/**
 * Pure, deterministic order pricing. All amounts are integer minor units (centavos).
 * Callers must load unit prices from the database; client-provided prices are never accepted.
 */
export function computeTotals(input: PricingInput): PricingResult {
  const lines = input.lines.filter((l) => l.quantity > 0);
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  const byProduct = new Map<string, { qty: number; amount: number; tierPricing: boolean; minUnit: number }>();
  for (const l of lines) {
    const entry = byProduct.get(l.productId) ?? { qty: 0, amount: 0, tierPricing: l.tierPricing, minUnit: l.unitPrice };
    entry.qty += l.quantity;
    entry.amount += l.unitPrice * l.quantity;
    entry.minUnit = Math.min(entry.minUnit, l.unitPrice);
    byProduct.set(l.productId, entry);
  }

  let tierDiscount = 0;
  for (const entry of byProduct.values()) {
    if (entry.tierPricing) tierDiscount += pctOf(entry.amount, volumeTierPct(entry.qty));
  }

  let bundleDiscount = 0;
  const appliedBundles: string[] = [];
  for (const bundle of input.bundles ?? []) {
    const members = bundle.productIds.map((id) => byProduct.get(id));
    if (members.some((m) => !m)) continue;
    const sets = Math.min(...members.map((m) => m!.qty));
    const setPrice = members.reduce((sum, m) => sum + m!.minUnit, 0);
    bundleDiscount += pctOf(setPrice * sets, bundle.pct);
    appliedBundles.push(bundle.id);
  }

  let merchandise = Math.max(0, subtotal - tierDiscount - bundleDiscount);
  const promos: PromoOutcome[] = [];
  let promoDiscount = 0;
  let freeShippingPromo = false;
  let nonStackableUsed = false;

  for (const promo of (input.promos ?? []).slice(0, MAX_PROMO_CODES)) {
    if (subtotal < promo.minSubtotal) {
      promos.push({ code: promo.code, applied: false, amount: 0, reason: "Minimum spend not reached" });
      continue;
    }
    if (!promo.stackable) {
      if (nonStackableUsed) {
        promos.push({ code: promo.code, applied: false, amount: 0, reason: "Cannot be combined with another discount code" });
        continue;
      }
      nonStackableUsed = true;
    }
    if (promo.type === "free_shipping") {
      freeShippingPromo = true;
      promos.push({ code: promo.code, applied: true, amount: 0 });
      continue;
    }
    const amount = Math.min(merchandise, promo.type === "percent" ? pctOf(merchandise, promo.value) : promo.value);
    merchandise -= amount;
    promoDiscount += amount;
    promos.push({ code: promo.code, applied: true, amount });
  }

  const tier = SHIPPING_RATES[input.shippingTier ?? "standard"];
  const qualifiesFree = merchandise >= FREE_SHIPPING_THRESHOLD || freeShippingPromo;
  const shippingFee =
    lines.length === 0 ? 0 : qualifiesFree ? Math.max(0, tier.fee - SHIPPING_RATES.standard.fee) : tier.fee;
  const giftWrapFee = input.giftWrap && lines.length > 0 ? GIFT_WRAP_FEE : 0;
  const total = merchandise + shippingFee + giftWrapFee;

  return {
    subtotal,
    tierDiscount,
    bundleDiscount,
    promoDiscount,
    merchandiseTotal: merchandise,
    shippingFee,
    freeShippingApplied: qualifiesFree && lines.length > 0,
    freeShippingRemaining: Math.max(0, FREE_SHIPPING_THRESHOLD - merchandise),
    giftWrapFee,
    taxIncluded: Math.round((total * VAT_RATE) / (1 + VAT_RATE)),
    total,
    promos,
    appliedBundles,
  };
}

export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}

export function deliveryWindow(tier: ShippingTierKey, from = new Date()): { from: Date; to: Date } {
  const rate = SHIPPING_RATES[tier];
  return { from: addBusinessDays(from, rate.minDays), to: addBusinessDays(from, rate.maxDays) };
}
