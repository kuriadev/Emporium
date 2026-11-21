import { describe, expect, it } from "vitest";
import { promoStatus, fromManilaInput, toManilaInput } from "@/lib/promo-status";
import { parseCatalogQuery } from "@/lib/catalog-query";
import { didYouMean, levenshtein } from "@/lib/search";
import { productInputSchema, promoInputSchema } from "@/lib/validations/admin";
import { registerSchema } from "@/lib/validations/auth";
import { luhnValid, quantitySchema } from "@/lib/validations/commerce";
import { sniffImage, validateImageUpload } from "@/server/security/image";

describe("auth validation", () => {
  it("rejects weak passwords and accepts strong ones", () => {
    const base = { name: "Alex Rivera", email: "alex@example.com", acceptTerms: true, company: "", startedAt: Date.now() - 5000 };
    expect(registerSchema.safeParse({ ...base, password: "password", confirmPassword: "password" }).success).toBe(false);
    const strong = registerSchema.safeParse({ ...base, password: "Customer#2026x", confirmPassword: "Customer#2026x" });
    expect(strong.success).toBe(true);
  });
});

describe("commerce validation", () => {
  it("validates card numbers with Luhn", () => {
    expect(luhnValid("4242424242424242")).toBe(true);
    expect(luhnValid("4242424242424241")).toBe(false);
  });

  it("caps quantities", () => {
    expect(quantitySchema.safeParse(0).success).toBe(false);
    expect(quantitySchema.safeParse(1.5).success).toBe(false);
    expect(quantitySchema.safeParse(1000).success).toBe(false);
    expect(quantitySchema.safeParse(2).success).toBe(true);
  });
});

describe("admin validation", () => {
  const product = {
    name: "Linen Overshirt",
    slug: "linen-overshirt",
    brand: "Emporium Studio",
    category: "clothes",
    basePrice: "1899.50",
    status: "active",
    images: [{ src: "/images/products/x.webp", alt: "Overshirt front" }],
    variants: [{ sku: "ems-lo-m", stock: "4" }],
  };

  it("converts pesos to centavos exactly once and normalises SKUs", () => {
    const r = productInputSchema.parse(product);
    expect(r.basePrice).toBe(189_950);
    expect(r.variants[0]!.sku).toBe("EMS-LO-M");
  });

  it("rejects script-y slugs, off-site images and compare-at below price", () => {
    expect(productInputSchema.safeParse({ ...product, slug: "<x>" }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...product, images: [{ src: "https://evil.test/a.png", alt: "x y" }] }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...product, compareAtPrice: "100" }).success).toBe(false);
  });

  it("validates promo windows and percent bounds", () => {
    const base = { code: "save20", type: "percent", value: "20", minSubtotal: "0" };
    expect(promoInputSchema.parse(base)).toMatchObject({ code: "SAVE20", value: 20 });
    expect(promoInputSchema.safeParse({ ...base, value: "95" }).success).toBe(false);
    expect(promoInputSchema.safeParse({ ...base, startsAt: "2026-12-10T10:00:00+08:00", endsAt: "2026-12-09T10:00:00+08:00" }).success).toBe(false);
    expect(promoInputSchema.parse({ ...base, type: "fixed", value: "300" }).value).toBe(30_000);
  });
});

describe("promo status", () => {
  const now = Date.UTC(2026, 10, 21);
  const p = { type: "percent" as const, value: 10, active: true, startsAt: null, endsAt: null, usageLimit: null, usedCount: 0 };
  it("mirrors checkout eligibility", () => {
    expect(promoStatus(p, now)).toBe("live");
    expect(promoStatus({ ...p, active: false }, now)).toBe("paused");
    expect(promoStatus({ ...p, startsAt: now + 1 }, now)).toBe("scheduled");
    expect(promoStatus({ ...p, endsAt: now - 1 }, now)).toBe("expired");
    expect(promoStatus({ ...p, usageLimit: 5, usedCount: 5 }, now)).toBe("used_up");
  });

  it("round-trips Manila wall time", () => {
    const ms = Date.parse("2026-11-21T09:30:00+08:00");
    expect(toManilaInput(ms)).toBe("2026-11-21T09:30");
    expect(Date.parse(fromManilaInput("2026-11-21T09:30"))).toBe(ms);
    expect(fromManilaInput("not a date")).toBe("");
  });
});

describe("search and catalog query", () => {
  it("suggests close matches for typos", () => {
    expect(levenshtein("headphnes", "headphones")).toBe(1);
    expect(didYouMean("headphnes", ["headphones", "furniture"])).toBe("headphones");
  });

  it("drops unknown filters and clamps values", () => {
    const q = parseCatalogQuery({ category: "weapons", sort: "drop table", page: "-4" });
    expect(q.categories).not.toContain("weapons");
    expect(q.page).toBeGreaterThanOrEqual(1);
  });
});

describe("upload sniffing", () => {
  const png = (w: number, h: number) => {
    const b = new Uint8Array(33);
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
    new DataView(b.buffer).setUint32(16, w);
    new DataView(b.buffer).setUint32(20, h);
    return b;
  };

  it("identifies files by magic bytes, not by name or declared type", () => {
    expect(sniffImage(png(400, 400))).toBe("png");
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });

  it("rejects mismatched MIME types and out-of-range dimensions", () => {
    expect(validateImageUpload(png(400, 400), "image/jpeg").ok).toBe(false);
    expect(validateImageUpload(png(50, 50), "image/png").ok).toBe(false);
    expect(validateImageUpload(png(9000, 400), "image/png").ok).toBe(false);
    expect(validateImageUpload(png(800, 600), "image/png")).toMatchObject({ ok: true, width: 800, height: 600 });
  });
});
