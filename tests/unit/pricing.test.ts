import { describe, expect, it } from "vitest";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_RATES, computeTotals, volumeTierPct, type PricingLine, type PricingPromo } from "@/lib/pricing";

const line = (unitPrice: number, quantity = 1, tierPricing = false, id = "p1"): PricingLine => ({ productId: id, variantId: `${id}-v`, unitPrice, quantity, tierPricing });
const promo = (p: Partial<PricingPromo> & Pick<PricingPromo, "code" | "type">): PricingPromo => ({ value: 0, minSubtotal: 0, stackable: false, ...p });

describe("computeTotals", () => {
  it("charges standard shipping below the free threshold and none above it", () => {
    expect(computeTotals({ lines: [line(1_000_00)] }).shippingFee).toBe(SHIPPING_RATES.standard.fee);
    expect(computeTotals({ lines: [line(FREE_SHIPPING_THRESHOLD)] }).shippingFee).toBe(0);
  });

  it("charges only the express upgrade when standard shipping is free", () => {
    expect(computeTotals({ lines: [line(1_000_00)], shippingTier: "express" }).shippingFee).toBe(SHIPPING_RATES.express.fee);
    expect(computeTotals({ lines: [line(9_000_00)], shippingTier: "express" }).shippingFee).toBe(SHIPPING_RATES.express.fee - SHIPPING_RATES.standard.fee);
  });

  it("works in integer centavos and keeps VAT inside the total", () => {
    const r = computeTotals({ lines: [line(1_234_56, 3)] });
    for (const v of [r.subtotal, r.total, r.taxIncluded]) expect(Number.isInteger(v)).toBe(true);
    expect(r.taxIncluded).toBeLessThan(r.total);
    expect(r.taxIncluded).toBeCloseTo(r.total - r.total / 1.12, -1);
  });

  it("applies volume pricing only to tier-priced products", () => {
    expect(volumeTierPct(1)).toBe(0);
    expect(volumeTierPct(2)).toBe(10);
    expect(volumeTierPct(5)).toBe(20);
    expect(computeTotals({ lines: [line(1_000_00, 3, true)] }).tierDiscount).toBe(600_00);
    expect(computeTotals({ lines: [line(1_000_00, 3, false)] }).tierDiscount).toBe(0);
  });

  it("enforces minimum spend and refuses to combine two non-stackable codes", () => {
    const r = computeTotals({
      lines: [line(2_000_00)],
      promos: [promo({ code: "SAVE100", type: "fixed", value: 100_00 }), promo({ code: "WELCOME10", type: "percent", value: 10 }), promo({ code: "BIG", type: "fixed", value: 1, minSubtotal: 5_000_00 })],
    });
    expect(r.promos.find((p) => p.code === "SAVE100")?.applied).toBe(true);
    expect(r.promos.find((p) => p.code === "WELCOME10")).toMatchObject({ applied: false, reason: expect.stringMatching(/combined/) });
    expect(r.promoDiscount).toBe(100_00);
  });

  it("stacks a free-shipping code with a discount code", () => {
    const r = computeTotals({ lines: [line(1_500_00)], promos: [promo({ code: "WELCOME10", type: "percent", value: 10 }), promo({ code: "FREESHIP", type: "free_shipping", stackable: true })] });
    expect(r.promoDiscount).toBe(150_00);
    expect(r.shippingFee).toBe(0);
  });

  it("never discounts below zero", () => {
    const r = computeTotals({ lines: [line(50_00)], promos: [promo({ code: "HUGE", type: "fixed", value: 10_000_00 })] });
    expect(r.promoDiscount).toBe(50_00);
    expect(r.total).toBeGreaterThanOrEqual(0);
  });
});
