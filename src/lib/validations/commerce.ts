import { z } from "zod";
import { botGuardSchema, cleanMultiline, cleanText, emailSchema, phoneSchema } from "./common";

export const MAX_LINE_QTY = 10;

export const quantitySchema = z.coerce
  .number({ error: "Quantity must be a number" })
  .int("Quantity must be a whole number")
  .min(1, "Quantity must be at least 1")
  .max(MAX_LINE_QTY, `You can order up to ${MAX_LINE_QTY} per item`);

export const addToCartSchema = z.object({
  variantId: z.string().min(1).max(64),
  quantity: quantitySchema,
});

export const updateCartSchema = z.object({
  variantId: z.string().min(1).max(64),
  quantity: z.coerce.number().int().min(0).max(MAX_LINE_QTY),
});

export const promoCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{3,20}$/, "Codes are 3–20 letters or numbers");

export function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

export const addressSchema = z.object({
  fullName: cleanText(2, 80, "Full name"),
  phone: phoneSchema,
  line1: cleanText(5, 120, "Street address"),
  line2: cleanText(0, 120, "Address line 2").optional().default(""),
  city: cleanText(2, 60, "City"),
  province: cleanText(2, 60, "Province"),
  postalCode: z.string().trim().regex(/^\d{4}$/, "Philippine postal codes have 4 digits"),
  country: z.literal("PH", { error: "We currently ship within the Philippines" }),
});

const cardSchema = z.object({
  method: z.literal("card"),
  cardName: cleanText(2, 80, "Name on card"),
  cardNumber: z
    .string()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^\d{13,19}$/, "Card numbers have 13–19 digits").refine(luhnValid, "That card number isn't valid")),
  cardExpiry: z
    .string()
    .trim()
    .regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "Use MM/YY")
    .refine((v) => {
      const [m, y] = v.split("/").map(Number);
      const end = new Date(2000 + y!, m!, 1);
      return end > new Date();
    }, "This card has expired"),
  cardCvc: z.string().trim().regex(/^\d{3,4}$/, "3 or 4 digits"),
});

const gcashSchema = z.object({
  method: z.literal("gcash"),
  gcashNumber: z.string().trim().regex(/^(\+63|0)9\d{9}$/, "GCash numbers look like 09171234567"),
});

const codSchema = z.object({ method: z.literal("cod") });

export const paymentSchema = z.discriminatedUnion("method", [cardSchema, gcashSchema, codSchema]);

export const checkoutSchema = z.object({
  idempotencyKey: z.uuid("Invalid checkout session, please refresh"),
  contact: z.object({ email: emailSchema, marketingOptIn: z.boolean().default(false) }),
  shipping: addressSchema,
  shippingTier: z.enum(["standard", "express"]),
  payment: paymentSchema,
  promoCodes: z.array(promoCodeSchema).max(2).default([]),
  giftWrap: z.boolean().default(false),
  giftNote: cleanMultiline(0, 240, "Gift note").optional().default(""),
  saveAddress: z.boolean().default(true),
});

export type CheckoutInput = z.input<typeof checkoutSchema>;
export type CheckoutData = z.output<typeof checkoutSchema>;

export const reviewSchema = z
  .object({
    productId: z.string().min(1).max(64),
    rating: z.coerce.number().int().min(1, "Pick a rating").max(5),
    title: cleanText(3, 80, "Title"),
    body: cleanMultiline(20, 1500, "Review"),
  })
  .merge(botGuardSchema);

export const restockAlertSchema = z.object({ variantId: z.string().min(1).max(64), email: emailSchema });

export const supportSchema = z
  .object({
    name: cleanText(2, 80, "Name"),
    email: emailSchema,
    topic: z.enum(["order", "returns", "product", "account", "other"]),
    message: cleanMultiline(20, 2000, "Message"),
  })
  .merge(botGuardSchema);

export const returnRequestSchema = z.object({
  orderId: z.string().min(1).max(64),
  reason: cleanMultiline(10, 500, "Reason"),
});

export const cancelOrderSchema = z.object({ orderId: z.string().min(1).max(64), reason: cleanText(3, 200, "Reason") });

export const savedAddressSchema = addressSchema.extend({ label: cleanText(2, 30, "Label"), isDefault: z.boolean().default(false) });
