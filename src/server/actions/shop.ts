"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult, CartView, SearchSuggestion } from "@/lib/types";
import type { ShippingTierKey } from "@/lib/pricing";
import { looksAutomated } from "@/lib/validations/common";
import {
  addToCartSchema,
  cancelOrderSchema,
  checkoutSchema,
  promoCodeSchema,
  restockAlertSchema,
  returnRequestSchema,
  reviewSchema,
  savedAddressSchema,
  supportSchema,
  updateCartSchema,
} from "@/lib/validations/commerce";
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "../db";
import { requireUser } from "../auth/guards";
import { ensureOwnerKey, getCurrentUser, readOwnerKey } from "../auth/session";
import { limiters, promoAttempt } from "../security/limiters";
import { clientIp } from "../security/request";
import { getProductBySlug, getProductsByIds, suggest } from "../services/catalog";
import { buildCartView, listWishlist, setCartQuantity, toggleWishlist } from "../services/cart";
import { cancelOrderAsCustomer, hasPurchased, placeOrder, requestReturn } from "../services/orders";
import { resolvePromos } from "../services/promo";
import { fail, ok, runAction, zodFailure } from "./run";

const quoteSchema = z.object({
  promoCodes: z.array(promoCodeSchema).max(2).default([]),
  shippingTier: z.enum(["standard", "express"]).default("standard"),
  giftWrap: z.boolean().default(false),
});

export type CartQuote = CartView & { rejectedPromos: { code: string; reason: string }[] };

async function quote(input: unknown = {}): Promise<CartQuote> {
  const opts = quoteSchema.parse(input);
  const user = await getCurrentUser();
  const { promos, rejected } = resolvePromos(opts.promoCodes, user?.id ?? null);
  const view = buildCartView(await readOwnerKey(), { promos, shippingTier: opts.shippingTier as ShippingTierKey, giftWrap: opts.giftWrap });
  const engineRejected = view.totals.promos.filter((p) => !p.applied).map((p) => ({ code: p.code, reason: p.reason ?? "Not applicable" }));
  return { ...view, rejectedPromos: [...rejected, ...engineRejected] };
}

export async function getCartAction(input?: unknown): Promise<ActionResult<CartQuote>> {
  try {
    return ok(await quote(input));
  } catch {
    return fail("Couldn't load your cart.");
  }
}

export async function addToCartAction(input: unknown): Promise<ActionResult<CartQuote>> {
  return runAction("cart.add", async () => {
    const parsed = addToCartSchema.safeParse(input);
    if (!parsed.success) return zodFailure(parsed.error);
    setCartQuantity(await ensureOwnerKey(), parsed.data.variantId, parsed.data.quantity, "add");
    return ok(await quote(), "Added to bag");
  });
}

export async function updateCartAction(input: unknown): Promise<ActionResult<CartQuote>> {
  return runAction("cart.update", async () => {
    const parsed = updateCartSchema.safeParse(input);
    if (!parsed.success) return zodFailure(parsed.error);
    setCartQuantity(await ensureOwnerKey(), parsed.data.variantId, parsed.data.quantity, "set");
    return ok(await quote());
  });
}

export async function addBundleAction(variantIds: unknown): Promise<ActionResult<CartQuote>> {
  return runAction("cart.bundle", async () => {
    const ids = z.array(z.string().min(1).max(64)).min(2).max(4).parse(variantIds);
    const owner = await ensureOwnerKey();
    // All-or-nothing: if one item is out of stock, none of the bundle lands in the bag.
    getDb().transaction(() => {
      for (const id of ids) setCartQuantity(owner, id, 1, "add");
    });
    return ok(await quote(), "Bundle added to bag");
  });
}

export async function quoteAction(input: unknown): Promise<ActionResult<CartQuote>> {
  return runAction("cart.quote", async () => {
    const parsed = quoteSchema.safeParse(input);
    if (!parsed.success) return zodFailure(parsed.error);
    if (parsed.data.promoCodes.length) {
      const user = await getCurrentUser();
      const rl = promoAttempt(user?.id ?? `ip:${await clientIp()}`, parsed.data.promoCodes);
      if (!rl.ok) return fail(`Too many code attempts. Try again in ${rl.retryAfterSeconds}s.`, { retryAfter: rl.retryAfterSeconds });
    }
    return ok(await quote(parsed.data));
  });
}

export async function placeOrderAction(input: unknown): Promise<ActionResult<{ orderId: string; number: string }>> {
  return runAction("checkout", async () => {
    const user = await getCurrentUser();
    if (!user) return fail("Please sign in to complete checkout.");
    if (user.role !== "customer") return fail("Staff accounts can't place orders.");
    const parsed = checkoutSchema.safeParse(input);
    if (!parsed.success) return zodFailure(parsed.error);
    const rl = limiters.checkout.hit(user.id);
    if (!rl.ok) return fail(`Too many checkout attempts. Try again in ${rl.retryAfterSeconds}s.`, { retryAfter: rl.retryAfterSeconds });
    const result = placeOrder(user, `u:${user.id}`, parsed.data);
    revalidatePath("/account");
    return ok({ orderId: result.orderId, number: result.number }, result.replayed ? "This order was already placed." : "Order confirmed!");
  });
}

export async function getWishlistAction(): Promise<string[]> {
  return listWishlist(await readOwnerKey());
}

export async function toggleWishlistAction(productId: unknown, on: unknown): Promise<ActionResult<string[]>> {
  return runAction("wishlist.toggle", async () => {
    const id = z.string().min(1).max(64).parse(productId);
    const owner = await ensureOwnerKey();
    toggleWishlist(owner, id, z.boolean().parse(on));
    return ok(listWishlist(owner));
  });
}

export async function searchAction(query: unknown): Promise<SearchSuggestion> {
  const q = z.string().max(80).catch("").parse(query);
  const rl = limiters.search.hit(await clientIp());
  if (!rl.ok) return { products: [], categories: [], didYouMean: null, trending: [], total: 0 };
  // Typeahead keystrokes are not recorded; the catalogue page records committed searches.
  return suggest(q, { record: false });
}

export async function restockAlertAction(input: unknown): Promise<ActionResult> {
  return runAction("restock", async () => {
    const parsed = restockAlertSchema.safeParse(input);
    if (!parsed.success) return zodFailure(parsed.error);
    const rl = limiters.publicForm.hit(`restock:${await clientIp()}`);
    if (!rl.ok) return fail("Too many requests. Try again shortly.", { retryAfter: rl.retryAfterSeconds });
    const user = await getCurrentUser();
    const variant = getDb().select({ id: schema.productVariants.id }).from(schema.productVariants).where(eq(schema.productVariants.id, parsed.data.variantId)).get();
    if (!variant) return fail("Item not found.");
    getDb().insert(schema.restockAlerts).values({ id: randomUUID(), variantId: variant.id, email: parsed.data.email, userId: user?.id ?? null }).onConflictDoNothing().run();
    return ok(null, "We'll email you the moment it's back.");
  });
}

export async function submitReviewAction(input: unknown): Promise<ActionResult> {
  return runAction("review", async () => {
    const user = await requireUser();
    const parsed = reviewSchema.safeParse(input);
    if (!parsed.success) return zodFailure(parsed.error);
    if (looksAutomated(parsed.data)) return fail("Please take a moment and try again.");
    if (!hasPurchased(user.id, parsed.data.productId)) return fail("Only verified buyers with a delivered order can review this product.");
    const db = getDb();
    const exists = db.select({ id: schema.reviews.id }).from(schema.reviews).where(and(eq(schema.reviews.productId, parsed.data.productId), eq(schema.reviews.userId, user.id))).get();
    if (exists) return fail("You've already reviewed this product.");
    const author = `${user.name.split(" ")[0]} ${user.name.split(" ")[1]?.[0] ?? ""}.`.trim();
    db.transaction((tx) => {
      tx.insert(schema.reviews)
        .values({ id: randomUUID(), productId: parsed.data.productId, userId: user.id, authorName: author, rating: parsed.data.rating, title: parsed.data.title, body: parsed.data.body, verified: true })
        .run();
      tx.update(schema.products)
        .set({
          ratingAvg: sql`(select round(avg(rating), 1) from reviews where product_id = ${parsed.data.productId})`,
          ratingCount: sql`(select count(*) from reviews where product_id = ${parsed.data.productId})`,
        })
        .where(eq(schema.products.id, parsed.data.productId))
        .run();
    });
    revalidatePath("/products/[slug]", "page");
    return ok(null, "Thanks! Your verified review is live.");
  });
}

export async function supportAction(input: unknown): Promise<ActionResult> {
  return runAction("support", async () => {
    const parsed = supportSchema.safeParse(input);
    if (!parsed.success) return zodFailure(parsed.error);
    if (looksAutomated(parsed.data)) return fail("Please take a moment and try again.");
    const rl = limiters.publicForm.hit(`support:${await clientIp()}`);
    if (!rl.ok) return fail("You've sent several messages already. Try again shortly.", { retryAfter: rl.retryAfterSeconds });
    const { name, email, topic, message } = parsed.data;
    getDb().insert(schema.supportMessages).values({ id: randomUUID(), name, email, topic, message }).run();
    return ok(null, "Thanks for reaching out! We reply within one business day.");
  });
}

export async function cancelOrderAction(input: unknown): Promise<ActionResult> {
  return runAction("order.cancel", async () => {
    const user = await requireUser();
    const parsed = cancelOrderSchema.safeParse(input);
    if (!parsed.success) return zodFailure(parsed.error);
    cancelOrderAsCustomer(user, parsed.data.orderId, parsed.data.reason);
    revalidatePath(`/orders/${parsed.data.orderId}`);
    return ok(null, "Order cancelled. Any payment will be refunded in 3–5 business days.");
  });
}

export async function requestReturnAction(input: unknown): Promise<ActionResult> {
  return runAction("order.return", async () => {
    const user = await requireUser();
    const parsed = returnRequestSchema.safeParse(input);
    if (!parsed.success) return zodFailure(parsed.error);
    requestReturn(user, parsed.data.orderId, parsed.data.reason);
    revalidatePath(`/orders/${parsed.data.orderId}`);
    return ok(null, "Return requested. We'll email a prepaid label within 24 hours.");
  });
}

export async function saveAddressAction(input: unknown): Promise<ActionResult> {
  return runAction("address.save", async () => {
    const user = await requireUser();
    const parsed = savedAddressSchema.safeParse(input);
    if (!parsed.success) return zodFailure(parsed.error);
    const db = getDb();
    db.transaction((tx) => {
      if (parsed.data.isDefault) tx.update(schema.addresses).set({ isDefault: false }).where(eq(schema.addresses.userId, user.id)).run();
      tx.insert(schema.addresses).values({ id: randomUUID(), userId: user.id, ...parsed.data }).run();
    });
    revalidatePath("/account");
    return ok(null, "Address saved");
  });
}

export async function deleteAddressAction(addressId: unknown): Promise<ActionResult> {
  return runAction("address.delete", async () => {
    const user = await requireUser();
    const id = z.string().min(1).max(64).parse(addressId);
    getDb().delete(schema.addresses).where(and(eq(schema.addresses.id, id), eq(schema.addresses.userId, user.id))).run();
    revalidatePath("/account");
    return ok(null, "Address removed");
  });
}

export async function quickViewAction(slug: unknown) {
  const s = z.string().regex(/^[a-z0-9-]{1,80}$/).safeParse(slug);
  return s.success ? getProductBySlug(s.data) : null;
}

export async function compareAction(ids: unknown) {
  const parsed = z.array(z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)).max(4).safeParse(ids);
  return parsed.success ? getProductsByIds(parsed.data) : [];
}

export async function productsByIdsAction(ids: unknown) {
  const parsed = z.array(z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)).max(8).safeParse(ids);
  return parsed.success ? getProductsByIds(parsed.data) : [];
}
