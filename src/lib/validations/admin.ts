import { z } from "zod";
import { cleanMultiline, cleanText } from "./common";

const CATEGORY_VALUES = ["gadgets", "furniture", "accessories", "clothes"] as const;
const PRODUCT_STATUS_VALUES = ["active", "draft", "archived"] as const;
export const ORDER_STATUS_VALUES = ["pending", "paid", "packed", "shipped", "delivered", "cancelled", "refunded"] as const;

const pesos = (label: string) =>
  z.coerce
    .number({ error: `${label} must be a number` })
    .finite()
    .min(0, `${label} cannot be negative`)
    .max(10_000_000, `${label} is unrealistically high`)
    .transform((v) => Math.round(v * 100));

export const variantInputSchema = z.object({
  id: z.string().max(64).optional(),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9-]{2,39}$/, "SKU: 3–40 letters, numbers or dashes"),
  color: cleanText(0, 40, "Color").optional().default(""),
  colorHex: z.union([z.literal(""), z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #1f2a5c")]).optional().default(""),
  size: cleanText(0, 40, "Size").optional().default(""),
  material: cleanText(0, 40, "Material").optional().default(""),
  priceOverride: z.union([z.literal(""), z.null(), pesos("Price override")]).optional().transform((v) => (typeof v === "number" ? v : null)),
  stock: z.coerce.number().int("Stock must be a whole number").min(0, "Stock cannot be negative").max(100_000),
  reorderThreshold: z.coerce.number().int().min(0).max(10_000).default(5),
});

export const productInputSchema = z
  .object({
    id: z.string().max(64).optional(),
    name: cleanText(2, 120, "Name"),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and single dashes only")
      .max(80),
    brand: cleanText(2, 60, "Brand"),
    category: z.enum(CATEGORY_VALUES),
    tagline: cleanText(0, 160, "Tagline").default(""),
    description: cleanMultiline(0, 8000, "Description").default(""),
    basePrice: pesos("Price").refine((v) => v >= 100, "Price must be at least ₱1.00"),
    compareAtPrice: z.union([z.literal(""), z.null(), pesos("Compare-at price")]).optional().transform((v) => (typeof v === "number" && v > 0 ? v : null)),
    status: z.enum(PRODUCT_STATUS_VALUES),
    featured: z.boolean().default(false),
    tierPricing: z.boolean().default(false),
    materials: cleanText(0, 200, "Materials").default(""),
    dimensions: cleanText(0, 200, "Dimensions").default(""),
    images: z
      .array(z.object({ src: z.string().regex(/^\/(images|media)\/[A-Za-z0-9/_.-]+$/, "Invalid image path"), alt: cleanText(2, 140, "Alt text") }))
      .min(1, "Add at least one image")
      .max(8),
    variants: z.array(variantInputSchema).min(1, "Add at least one variant").max(60, "Up to 60 variants"),
  })
  .superRefine((p, ctx) => {
    if (p.compareAtPrice !== null && p.compareAtPrice <= p.basePrice) {
      ctx.addIssue({ code: "custom", path: ["compareAtPrice"], message: "Compare-at price must be higher than the price" });
    }
    const skus = new Set<string>();
    p.variants.forEach((v, i) => {
      if (skus.has(v.sku)) ctx.addIssue({ code: "custom", path: ["variants", i, "sku"], message: "Duplicate SKU" });
      skus.add(v.sku);
    });
  });

export type ProductInput = z.input<typeof productInputSchema>;
export type ProductData = z.output<typeof productInputSchema>;

export const bulkProductActionSchema = z.object({
  productIds: z.array(z.string().min(1).max(64)).min(1, "Select at least one product").max(200),
  action: z.enum(["activate", "draft", "archive", "adjust_price", "set_stock"]),
  value: z.coerce.number().finite().min(-90).max(100_000).optional(),
});

export const orderTransitionSchema = z
  .object({
    orderId: z.string().min(1).max(64),
    to: z.enum(ORDER_STATUS_VALUES),
    note: cleanText(0, 240, "Note").optional().default(""),
    carrier: cleanText(0, 40, "Carrier").optional().default(""),
    trackingNumber: z.string().trim().max(40).regex(/^[A-Za-z0-9-]*$/, "Letters, numbers and dashes only").optional().default(""),
    refundAmount: z.coerce.number().min(0).max(10_000_000).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.to === "shipped" && (!d.carrier || !d.trackingNumber)) {
      ctx.addIssue({ code: "custom", path: ["trackingNumber"], message: "Carrier and tracking number are required to ship" });
    }
    if ((d.to === "refunded" || d.to === "cancelled") && d.note.length < 3) {
      ctx.addIssue({ code: "custom", path: ["note"], message: "Give a reason (logged in the audit trail)" });
    }
  });

export const returnDecisionSchema = z.object({
  orderId: z.string().min(1).max(64),
  note: cleanText(3, 240, "Reason"),
});

export const promoInputSchema = z
  .object({
    id: z.string().max(64).optional(),
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,20}$/, "3–20 letters or numbers"),
    description: cleanText(0, 160, "Description").default(""),
    type: z.enum(["percent", "fixed", "free_shipping"]),
    value: z.coerce.number().finite().min(0),
    minSubtotal: pesos("Minimum spend").default(0),
    startsAt: z.union([z.literal(""), z.coerce.date()]).optional().transform((v) => (v instanceof Date ? v : null)),
    endsAt: z.union([z.literal(""), z.coerce.date()]).optional().transform((v) => (v instanceof Date ? v : null)),
    usageLimit: z.union([z.literal(""), z.coerce.number().int().min(1)]).optional().transform((v) => (typeof v === "number" ? v : null)),
    perUserLimit: z.union([z.literal(""), z.coerce.number().int().min(1)]).optional().transform((v) => (typeof v === "number" ? v : null)),
    stackable: z.boolean().default(false),
    active: z.boolean().default(true),
  })
  .superRefine((p, ctx) => {
    if (p.type === "percent" && (p.value < 1 || p.value > 90)) ctx.addIssue({ code: "custom", path: ["value"], message: "Percent must be 1–90" });
    if (p.type === "fixed" && p.value < 1) ctx.addIssue({ code: "custom", path: ["value"], message: "Enter an amount in pesos" });
    if (p.startsAt && p.endsAt && p.endsAt <= p.startsAt) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End must be after start" });
  })
  .transform((p) => ({ ...p, value: p.type === "fixed" ? Math.round(p.value * 100) : p.type === "free_shipping" ? 0 : Math.round(p.value) }));

export type PromoInput = z.input<typeof promoInputSchema>;
export type PromoData = z.output<typeof promoInputSchema>;

export const customerAdminSchema = z.object({
  userId: z.string().min(1).max(64),
  status: z.enum(["active", "suspended"]).optional(),
  notes: cleanMultiline(0, 2000, "Notes").optional(),
});

export const csvProductRowSchema = z.object({
  sku: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9-]{2,39}$/, "invalid SKU"),
  price: z.union([z.literal(""), z.coerce.number().min(1).max(10_000_000)]).optional(),
  stock: z.union([z.literal(""), z.coerce.number().int().min(0).max(100_000)]).optional(),
  status: z.union([z.literal(""), z.enum(PRODUCT_STATUS_VALUES)]).optional(),
});
